package MindChatBot.mindChatBot.controller;

import MindChatBot.mindChatBot.model.Mood;
import MindChatBot.mindChatBot.service.MoodService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.*;

@RestController
@RequestMapping("/user/moods")
public class MoodController {

    private final MoodService moodService;

    @Autowired
    public MoodController(MoodService moodService) { this.moodService = moodService; }

    @GetMapping("/fetch")
    public List<Mood> getMoodsByQuery(@RequestParam int year, @RequestParam int month) {
        String userId = getCurrentUserId();
        return moodService.getMoodsByMonth(userId, year, month);
    }

    @PostMapping("/fetch")
    public List<Mood> getMoodsByJson(@RequestBody Map<String, Integer> request) {
        String userId = getCurrentUserId();
        Integer year = request.get("year");
        Integer month = request.get("month");
        if (year == null || month == null) throw new IllegalArgumentException("Year and month must be provided.");
        return moodService.getMoodsByMonth(userId, year, month);
    }

    @PostMapping("/save")
    public Mono<Map<String, Object>> saveMood(
            @RequestBody Mood mood,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {

        String userId = getCurrentUserId();
        String bodyLang = (mood.getLang() == null ? null : mood.getLang());
        String lang = normalizeLang(bodyLang, acceptLanguage, LocaleContextHolder.getLocale());
        return moodService.saveMoodWithReply(userId, mood, lang);
    }

    @GetMapping("/stats")
    public Map<String, Object> getMoodStats() {
        String userId = getCurrentUserId();
        return moodService.getMoodStatistics(userId);
    }

    @GetMapping("/all")
    public List<Mood> getAllMoods() {
        String userId = getCurrentUserId();
        return moodService.getAllMoodsForUser(userId);
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

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) throw new IllegalStateException("No authentication in context");
        Object p = auth.getPrincipal();
        if (p instanceof MindChatBot.mindChatBot.model.User u) return u.getId();
        if (p instanceof org.springframework.security.core.userdetails.User u) return u.getUsername();
        return String.valueOf(p);
    }
}
