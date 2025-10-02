package MindChatBot.mindChatBot.controller;

import MindChatBot.mindChatBot.model.ChatLog;
import MindChatBot.mindChatBot.service.OpenAiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.*;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final OpenAiService openAiService;

    @Autowired
    public ChatController(OpenAiService openAiService) { this.openAiService = openAiService; }

    @PostMapping
    public Mono<ResponseEntity<Map<String, String>>> chatWithBot(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {

        String userId = resolveUserId(body);
        String message = Objects.toString(body.getOrDefault("message", ""), "").trim();

        if (!StringUtils.hasText(message)) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Message is empty.")));
        }

        String lang = normalizeLang(
                asStringOrNull(body.get("lang")),
                acceptLanguage,
                LocaleContextHolder.getLocale()
        );

        return openAiService.getChatHistory(userId)
                .collectList()
                .flatMap(historyList -> {
                    int from = Math.max(0, historyList.size() - 5);
                    List<ChatLog> recentHistory = historyList.subList(from, historyList.size());
                    return openAiService.sendMessageToOpenAI(recentHistory, message, userId, lang)
                            .flatMap(response ->
                                    openAiService.saveChatLog(userId, message, response)
                                            .thenReturn(ResponseEntity.ok(Map.of("response", response))));
                })
                .onErrorResume(err ->
                        Mono.just(ResponseEntity.status(500)
                                .body(Map.of("error", "An error occurred while communicating with OpenAI."))));
    }

    @GetMapping("/history/{userId}")
    public Mono<ResponseEntity<List<ChatLog>>> getChatHistory(@PathVariable String userId) {
        return openAiService.getChatHistory(userId)
                .collectList()
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().build()));
    }

    private static String asStringOrNull(Object o) {
        return (o instanceof String s && StringUtils.hasText(s)) ? s : null;
    }

    private static String normalizeLang(String bodyLang, String headerLang, java.util.Locale reqLocale) {
        String l = (StringUtils.hasText(bodyLang) ? bodyLang
                : (StringUtils.hasText(headerLang) ? headerLang
                : (reqLocale != null ? reqLocale.getLanguage() : "en")));
        l = l.toLowerCase(Locale.ROOT);
        if (l.startsWith("ko")) return "ko";
        if (l.startsWith("ru")) return "ru";
        return "en";
    }

    private String resolveUserId(Map<String, Object> body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            Object p = auth.getPrincipal();
            if (p instanceof MindChatBot.mindChatBot.model.User u) return u.getId();
            if (p instanceof org.springframework.security.core.userdetails.User u) return u.getUsername();
            return String.valueOf(p);
        }
        return Objects.toString(body.getOrDefault("userId", "guest"), "guest");
    }
}
