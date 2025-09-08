// File: MindChatBot/mindChatBot/controller/MoodController.java
package MindChatBot.mindChatBot.controller;

import MindChatBot.mindChatBot.model.Mood;
import MindChatBot.mindChatBot.service.MoodService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/user/moods")
public class MoodController {

    private final MoodService moodService;

    @Autowired
    public MoodController(MoodService moodService) {
        this.moodService = moodService;
    }

    // ✅ New: GET version (no CSRF)
    @GetMapping("/fetch")
    public List<Mood> getMoodsByQuery(@RequestParam int year, @RequestParam int month) {
        String userId = getCurrentUserId();
        return moodService.getMoodsByMonth(userId, year, month);
    }

    // (keep if you also call POST elsewhere; otherwise you can remove)
    @PostMapping("/fetch")
    public List<Mood> getMoodsByJson(@RequestBody Map<String, Integer> request) {
        String userId = getCurrentUserId();
        Integer year = request.get("year");
        Integer month = request.get("month");
        if (year == null || month == null) throw new IllegalArgumentException("Year and month must be provided.");
        return moodService.getMoodsByMonth(userId, year, month);
    }

    @PostMapping("/save")
    public Mono<Map<String, Object>> saveMood(@RequestBody MindChatBot.mindChatBot.model.Mood mood) {
        String userId = getCurrentUserId();
        return moodService.saveMoodWithReply(userId, mood);
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

    // ✅ Robust principal resolution: supports String, Spring UserDetails, or your User
    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) throw new IllegalStateException("No authentication in context");
        Object p = auth.getPrincipal();
        if (p instanceof MindChatBot.mindChatBot.model.User u) return u.getId();
        if (p instanceof org.springframework.security.core.userdetails.User u) return u.getUsername();
        return String.valueOf(p); // e.g., email if you used subject as principal
    }
}
