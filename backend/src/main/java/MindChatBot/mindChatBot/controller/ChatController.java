package MindChatBot.mindChatBot.controller;

import MindChatBot.mindChatBot.model.ChatLog;
import MindChatBot.mindChatBot.model.User; // <-- Import User model
import MindChatBot.mindChatBot.service.OpenAiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final OpenAiService openAiService;

    @Autowired
    public ChatController(OpenAiService openAiService) {
        this.openAiService = openAiService;
    }

    @PostMapping
    public Mono<ResponseEntity<Map<String, String>>> chatWithBot(
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {

        // --- USER ID IS NOW FETCHED SECURELY ---
        String userId;
        try {
            userId = getCurrentUserId();
        } catch (IllegalStateException e) {
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "User not authenticated.")));
        }

        String message = Objects.toString(body.getOrDefault("message", ""), "").trim();

        if (!StringUtils.hasText(message)) {
            return Mono.just(ResponseEntity.badRequest().body(Map.of("error", "Message is empty.")));
        }

        // --- ENFORCE THE DAILY LIMIT HERE ---
        // Pass Collections.emptyList() because history is now loaded inside the service
        return openAiService.sendMessageToOpenAI(Collections.emptyList(), message, userId,
                        normalizeLang(asStringOrNull(body.get("lang")), acceptLanguage, LocaleContextHolder.getLocale()))
                .flatMap(response -> {
                    // If the response is null or empty (user exceeded limit and warning already sent)
                    if (response == null || response.isBlank()) {
                        log.warn("User '{}' attempted to chat after daily limit. Returning empty response.", userId);
                        return Mono.just(ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                                .body(Map.of("error", "Daily message limit reached. Please try again tomorrow.")));
                    }

                    // Save chat and return response normally
                    return openAiService.saveChatLog(userId, message, response)
                            .thenReturn(ResponseEntity.ok(Map.of("response", response)));
                })
                .onErrorResume(err -> {
                    log.error("An unexpected error occurred in the chat flow for user '{}': {}", userId, err.getMessage());
                    return Mono.just(ResponseEntity.status(500)
                            .body(Map.of("error", "An error occurred while communicating with the chat service.")));
                });
    }

    @GetMapping("/history/{userId}")
    public Mono<ResponseEntity<List<ChatLog>>> getChatHistory(@PathVariable String userId) {
        // --- SECURELY CHECK USER ID ---
        String authenticatedUserId;
        try {
            authenticatedUserId = getCurrentUserId();
        } catch (IllegalStateException e) {
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
        }

        // Prevent one user from seeing another's history
        if (!Objects.equals(userId, authenticatedUserId)) {
            log.warn("Security check: User '{}' tried to access history for user '{}'.", authenticatedUserId, userId);
            return Mono.just(ResponseEntity.status(HttpStatus.FORBIDDEN).build());
        }

        return openAiService.getChatHistory(userId)
                .collectList()
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(ResponseEntity.internalServerError().build()));
    }

    // --- Helper Methods ---
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

    // --- SECURE HELPER TO GET LOGGED-IN USER ---
    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new IllegalStateException("No authentication in context");
        }
        Object p = auth.getPrincipal();

        // This handles both cases: when the principal is your custom User object
        // or when it's the default Spring UserDetails object.
        if (p instanceof MindChatBot.mindChatBot.model.User u) {
            return u.getId();
        }
        if (p instanceof org.springframework.security.core.userdetails.User u) {
            return u.getUsername(); // Your UserDetailService uses email as the username
        }

        // Fallback for when the principal is just the username string
        return String.valueOf(p);
    }
}