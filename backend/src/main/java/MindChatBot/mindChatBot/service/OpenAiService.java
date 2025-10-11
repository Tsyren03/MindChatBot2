package MindChatBot.mindChatBot.service;

import MindChatBot.mindChatBot.model.ChatLog;
import MindChatBot.mindChatBot.repository.ChatLogRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class OpenAiService {

    private final WebClient webClient;
    private final ChatLogRepository chatLogRepository;

    // The daily message limit per user
    private static final int DAILY_MESSAGE_LIMIT = 10;

    // Track users who have already received the daily limit warning
    private final Set<String> warnedUsers = ConcurrentHashMap.newKeySet();

    @Value("${openai.api.key}")
    private String openaiApiKey;

    @Value("${openai.model:gpt-4.1-nano}")
    private String model;

    @Value("${openai.system.prompt:}")
    private String systemPrompt;

    public OpenAiService(WebClient.Builder webClientBuilder, ChatLogRepository chatLogRepository) {
        this.webClient = webClientBuilder.baseUrl("https://api.openai.com/v1").build();
        this.chatLogRepository = chatLogRepository;
    }

    public Mono<Boolean> isLimitReached(String userId) {
        return Mono.fromCallable(() -> {
            LocalDateTime startOfDay = LocalDate.now(ZoneOffset.UTC).atStartOfDay();
            long messagesToday = chatLogRepository.countByUserIdAndTimestampAfter(userId, startOfDay);
            log.info("User {} has sent {} messages today.", userId, messagesToday);
            return messagesToday >= DAILY_MESSAGE_LIMIT;
        });
    }

    /* ---------- Public API ---------- */

    /** NEW: language-aware send with daily limit warning once per user */
    public Mono<String> sendMessageToOpenAI(List<ChatLog> history, String message, String userId, String lang) {
        return isLimitReached(userId)
                .flatMap(limitReached -> {
                    if (limitReached) {
                        // Only warn once
                        if (!warnedUsers.contains(userId)) {
                            warnedUsers.add(userId);
                            log.info("User {} reached daily limit of {}", userId, DAILY_MESSAGE_LIMIT);
                            return Mono.just("⚠️ You have reached the daily chat limit. Please try again tomorrow.");
                        } else {
                            // silently ignore further requests after first warning
                            log.info("User {} attempted to chat after daily limit, ignored.", userId);
                            return Mono.empty();
                        }
                    }

                    // Remove warning if user hasn't hit limit
                    warnedUsers.remove(userId);

                    // Proceed with OpenAI call
                    String l = normalizedLang(lang);
                    List<Map<String, String>> messages = new ArrayList<>();
                    messages.add(Map.of("role", "system", "content", systemPromptFor(l)));

                    String userName = safeUserName(userId);

                    int maxHistory = 5;
                    int startIdx = Math.max(0, history.size() - maxHistory);
                    for (int i = startIdx; i < history.size(); i++) {
                        ChatLog chat = history.get(i);
                        String userMsg = trim200(chat.getMessage());
                        String botResp = trim200(chat.getResponse());
                        if (userMsg != null) messages.add(Map.of("role", "user", "content", userMsg));
                        if (botResp != null) messages.add(Map.of("role", "assistant", "content", botResp));
                    }

                    messages.add(Map.of("role", "user", "content", trim200(message)));

                    Map<String, Object> requestBody = new HashMap<>();
                    requestBody.put("model", model);
                    requestBody.put("messages", messages);
                    if (userName != null) requestBody.put("user", userName);

                    return webClient.post()
                            .uri("/chat/completions")
                            .header("Authorization", "Bearer " + openaiApiKey)
                            .bodyValue(requestBody)
                            .retrieve()
                            .bodyToMono(Map.class)
                            .flatMap(this::extractMessage)
                            .switchIfEmpty(Mono.fromCallable(() -> {
                                log.warn("OpenAI returned empty body/choices for user={}", userName);
                                return "(empty response)";
                            }))
                            .onErrorResume(e -> {
                                log.error("OpenAI call failed: {}", e.getMessage(), e);
                                return Mono.just("(Chat service is temporarily unavailable.)");
                            });
                });
    }

    /** Old signature kept for compatibility (defaults to English) */
    public Mono<String> sendMessageToOpenAI(List<ChatLog> history, String message, String userId) {
        return sendMessageToOpenAI(history, message, userId, "en");
    }

    public Mono<Map<String, String>> analyzeMoodFromNote(String noteContent) {
        String prompt = "Below is a user's journal entry. Classify the emotion of this entry as one of the following.\n" +
                "Main mood: best, good, neutral, poor, bad\n" +
                "Sub mood list:\n" +
                "- best: proud, grateful, energetic, excited, fulfilled\n" +
                "- good: calm, productive, hopeful, motivated, friendly\n" +
                "- neutral: indifferent, blank, tired, bored, quiet\n" +
                "- poor: frustrated, overwhelmed, nervous, insecure, confused\n" +
                "- bad: angry, sad, lonely, anxious, hopeless\n" +
                "\nRespond ONLY in the following JSON format. Example: {\"main\":\"good\", \"sub\":\"hopeful\"}\n" +
                "Journal: " + noteContent;

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
                "You are an emotion classifier. Classify strictly using the provided mood list and return only JSON."));
        messages.add(Map.of("role", "user", "content", prompt));

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", messages);

        return webClient.post()
                .uri("/chat/completions")
                .header("Authorization", "Bearer " + openaiApiKey)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .flatMap(res -> extractMessage(res).flatMap(content -> {
                    try {
                        String c = (content == null) ? "" : content.trim();
                        if (c.startsWith("{")) {
                            return Mono.just(new ObjectMapper()
                                    .readValue(c, new TypeReference<Map<String, String>>() {}));
                        }
                        log.warn("Classifier returned non-JSON content: {}", c);
                        return Mono.error(new IllegalStateException("Classifier returned non-JSON content"));
                    } catch (Exception e) {
                        log.error("Error parsing mood JSON: {}", e.getMessage(), e);
                        return Mono.error(new RuntimeException("Error parsing mood JSON", e));
                    }
                }));
    }

    public Flux<ChatLog> getChatHistory(String userId) {
        List<ChatLog> logs = chatLogRepository.findByUserIdOrderByTimestampAsc(userId);
        // Return only current user's logs to avoid showing other users
        return Flux.fromIterable(logs).filter(log -> userId.equals(log.getUserId()));
    }

    public Mono<Void> saveChatLog(String userId, String message, String response) {
        ChatLog log = new ChatLog(userId, message, response);
        return Mono.fromCallable(() -> chatLogRepository.save(log)).then();
    }

    /* ---------- helpers ---------- */

    private static String trim200(String s) {
        if (s == null) return null;
        return (s.length() > 200) ? s.substring(0, 200) + "..." : s;
    }

    private static String safeUserName(String userId) {
        if (userId == null || "anonymous".equalsIgnoreCase(userId)) return null;
        if (userId.contains("@")) return userId.substring(0, userId.indexOf('@'));
        return userId;
    }

    private Mono<String> extractMessage(Map<?, ?> response) {
        try {
            List<?> choices = (List<?>) response.get("choices");
            if (choices == null || choices.isEmpty()) {
                log.warn("OpenAI: no choices found in response: {}", response);
                return Mono.empty();
            }
            Map<?, ?> choice = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) choice.get("message");
            String content = (message == null) ? null : (String) message.get("content");
            if (content == null || content.isBlank()) {
                log.warn("OpenAI: empty content in first choice: {}", choice);
                return Mono.empty();
            }
            return Mono.just(content);
        } catch (Exception ex) {
            log.error("OpenAI: failed to parse response: {}", ex.getMessage(), ex);
            return Mono.empty();
        }
    }

    private static String normalizedLang(String lang) {
        if (lang == null) return "en";
        lang = lang.toLowerCase(Locale.ROOT);
        if (lang.startsWith("ko")) return "ko";
        if (lang.startsWith("ru")) return "ru";
        return "en";
    }

    private String systemPromptFor(String lang) {
        String defaultEn = (systemPrompt != null && !systemPrompt.isBlank())
                ? systemPrompt
                : "You are a supportive mental-health companion. "
                + "Reply concisely (2–4 sentences) with empathy. Use plain, friendly language. "
                + "Never give medical diagnoses; suggest professional help when appropriate.";

        switch (lang) {
            case "ko":
                return "당신은 공감적인 멘탈 헬스 동반자입니다. "
                        + "항상 한국어로, 2–4문장 안에서 따뜻하고 친절하게 응답하세요. "
                        + "진단이나 처방은 피하고, 필요하면 전문가의 도움을 권하세요.";
            case "ru":
                return "Вы — поддерживающий помощник по ментальному здоровью. "
                        + "Отвечайте по-русски, кратко (2–4 предложения), тепло и с эмпатией. "
                        + "Не ставьте диагнозы и не давайте медицинских назначений; при необходимости советуйте обратиться к специалисту.";
            default:
                return defaultEn;
        }
    }
}
