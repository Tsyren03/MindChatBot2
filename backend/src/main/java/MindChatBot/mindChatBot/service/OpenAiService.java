package MindChatBot.mindChatBot.service;

import MindChatBot.mindChatBot.model.ChatLog;
import MindChatBot.mindChatBot.repository.ChatLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.*;

@Service
public class OpenAiService {


    private final WebClient webClient;
    private final ChatLogRepository chatLogRepository;

    @Value("${openai.api.key}")
    private String openaiApiKey;

    @Value("${openai.model:gpt-4.1-nano}")
    private String model;

    @Value("${openai.system.prompt}")
    private String systemPrompt;

    public OpenAiService(WebClient.Builder webClientBuilder, ChatLogRepository chatLogRepository) {
        this.webClient = webClientBuilder.baseUrl("https://api.openai.com/v1").build();
        this.chatLogRepository = chatLogRepository;
    }

    public Mono<String> sendMessageToOpenAI(List<ChatLog> history, String message, String userId) {
        List<Map<String, String>> messages = new ArrayList<>();

        // 사용자 이름 추출 (이메일에서 @ 앞부분, 또는 userId가 이름이면 이름으로)
        String userName = null;
        if (userId != null && !userId.equals("anonymous")) {
            if (userId.contains("@")) {
                userName = userId.substring(0, userId.indexOf("@"));
            } else {
                userName = userId;
            }
        }

        // application.yml에서 systemPrompt를 읽어와 사용
        String personalizedPrompt = systemPrompt;
        messages.add(Map.of("role", "system", "content", personalizedPrompt));

        // 기존 히스토리 중 최근 3개만, 각 메시지는 200자 이내로 자름
        int maxHistory = 5;
        int startIdx = Math.max(0, history.size() - maxHistory);
        for (int i = startIdx; i < history.size(); i++) {
            ChatLog chat = history.get(i);
            String userMsg = chat.getMessage();
            String botResp = chat.getResponse();
            if (userMsg != null && userMsg.length() > 200) userMsg = userMsg.substring(0, 200) + "...";
            if (botResp != null && botResp.length() > 200) botResp = botResp.substring(0, 200) + "...";
            messages.add(Map.of("role", "user", "content", userMsg));
            messages.add(Map.of("role", "assistant", "content", botResp));
        }

        // 현재 사용자 메시지 추가 (200자 제한)
        String trimmedMsg = message != null && message.length() > 200 ? message.substring(0, 200) + "..." : message;
        messages.add(Map.of("role", "user", "content", trimmedMsg));

        // 전체 요청을 Map으로 구성
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", messages);
        if (userName != null) {
            requestBody.put("user", userName);
        }

        return webClient.post()
                .uri("/chat/completions")
                .header("Authorization", "Bearer " + openaiApiKey)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .flatMap(responseMap -> {
                    try {
                        List<Map<String, Object>> choices = (List<Map<String, Object>>) responseMap.get("choices");
                        if (choices != null && !choices.isEmpty()) {
                            Map<String, Object> messageMap = (Map<String, Object>) choices.get(0).get("message");
                            String content = (String) messageMap.get("content");
                            return Mono.justOrEmpty(content);
                        }
                    } catch (Exception e) {
                        return Mono.error(new RuntimeException("Error parsing OpenAI response", e));
                    }
                    return Mono.empty();
                });
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
        messages.add(Map.of("role", "system", "content", "You are an emotion classifier. Classify the user's journal entry strictly using the provided mood list."));
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
                .flatMap(responseMap -> {
                    try {
                        List<Map<String, Object>> choices = (List<Map<String, Object>>) responseMap.get("choices");
                        if (choices != null && !choices.isEmpty()) {
                            Map<String, Object> messageMap = (Map<String, Object>) choices.get(0).get("message");
                            String content = (String) messageMap.get("content");
                            // JSON parsing
                            content = content.trim();
                            if (content.startsWith("{")) {
                                return Mono.just(new ObjectMapper().readValue(content, new TypeReference<Map<String, String>>() {}));
                            }
                        }
                    } catch (Exception e) {
                        return Mono.error(new RuntimeException("Error parsing mood JSON", e));
                    }
                    return Mono.empty();
                });
    }

    private Optional<String> extractMessage(Map<?, ?> response) {
        try {
            List<?> choices = (List<?>) response.get("choices");
            if (choices != null && !choices.isEmpty()) {
                Map<?, ?> choice = (Map<?, ?>) choices.get(0);
                Map<?, ?> message = (Map<?, ?>) choice.get("message");
                return Optional.ofNullable((String) message.get("content"));
            }
        } catch (Exception ignored) {}
        return Optional.empty();
    }

    public Flux<ChatLog> getChatHistory(String userId) {
        List<ChatLog> logs = chatLogRepository.findByUserIdOrderByTimestampAsc(userId);
        return Flux.fromIterable(logs);
    }

    public Mono<Void> saveChatLog(String userId, String message, String response) {
        ChatLog log = new ChatLog(userId, message, response);
        return Mono.fromCallable(() -> chatLogRepository.save(log))
                .then();
    }
}
