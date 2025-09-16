package MindChatBot.mindChatBot.service;

import MindChatBot.mindChatBot.model.ChatLog;
import MindChatBot.mindChatBot.model.Mood;
import MindChatBot.mindChatBot.repository.ChatLogRepository;
import MindChatBot.mindChatBot.repository.MoodRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.*;

@Service
public class MoodService {

    @Autowired
    private OpenAiService openAiService;

    @Autowired
    private MoodRepository moodRepository;

    @Autowired
    private ChatLogRepository chatLogRepository;

    // Main → Sub mood map
    private static final Map<String, List<String>> MOOD_MAP = Map.of(
            "best",    List.of("proud", "grateful", "energetic", "excited", "fulfilled"),
            "good",    List.of("calm", "productive", "hopeful", "motivated", "friendly"),
            "neutral", List.of("indifferent", "blank", "tired", "bored", "quiet"),
            "poor",    List.of("frustrated", "overwhelmed", "nervous", "insecure", "confused"),
            "bad",     List.of("angry", "sad", "lonely", "anxious", "hopeless")
    );

    /** Helper: validate a main/sub pair */
    public boolean isValidMood(String main, String sub) {
        return main != null && sub != null
                && MOOD_MAP.containsKey(main)
                && MOOD_MAP.get(main).contains(sub);
    }
    // --- Aliases to keep older code working ---
    public Mood saveOrUpdateMood(String userId, int year, int month, int day, String main, String sub) {
        return upsertMood(userId, year, month, day, main, sub);
    }

    public Mood saveOrUpdateMood(String userId, java.time.LocalDate date, String main, String sub) {
        return upsertMood(userId, date.getYear(), date.getMonthValue(), date.getDayOfMonth(), main, sub);
    }

    public Mood saveOrUpdateMood(String userId, Mood mood) {
        return upsertMood(userId, mood.getYear(), mood.getMonth(), mood.getDay(), mood.getEmoji(), mood.getSubMood());
    }

    /**
     * NEW: Silent upsert used by the "save note → classify mood → save calendar mood"
     * flow. This does NOT call ChatGPT, so you won’t get a duplicate chat reply.
     */
    public Mood upsertMood(String userId, int year, int month, int day, String main, String sub) {
        if (!isValidMood(main, sub)) {
            throw new IllegalArgumentException(
                    "Invalid mood combo: main='" + main + "', sub='" + sub + "'");
        }

        Mood existing = moodRepository.findByUserIdAndYearAndMonthAndDay(userId, year, month, day);
        if (existing != null) {
            existing.setEmoji(main);
            existing.setSubMood(sub);
            return moodRepository.save(existing);
        }

        Mood m = new Mood();
        m.setUserId(userId);
        m.setYear(year);
        m.setMonth(month);
        m.setDay(day);
        m.setEmoji(main);
        m.setSubMood(sub);
        return moodRepository.save(m);
    }

    /** Fetch moods for a specific month */
    public List<Mood> getMoodsByMonth(String userId, int year, int month) {
        return moodRepository.findByUserIdAndYearAndMonth(userId, year, month);
    }

    /**
     * Existing: Save mood AND get a chat reply (used by calendar buttons or places
     * where you DO want a bot message). Kept unchanged for backwards compatibility.
     */
    public Mono<Map<String, Object>> saveMoodWithReply(String userId, Mood mood) {
        List<String> validSubMoods = MOOD_MAP.getOrDefault(mood.getEmoji(), List.of());
        if (!validSubMoods.contains(mood.getSubMood())) {
            return Mono.error(new IllegalArgumentException("Invalid subMood '" + mood.getSubMood()
                    + "' for emoji '" + mood.getEmoji() + "'"));
        }

        Mood savedMood;
        Mood existingMood = moodRepository.findByUserIdAndYearAndMonthAndDay(
                userId, mood.getYear(), mood.getMonth(), mood.getDay());

        if (existingMood != null) {
            existingMood.setEmoji(mood.getEmoji());
            existingMood.setSubMood(mood.getSubMood());
            savedMood = moodRepository.save(existingMood);
        } else {
            mood.setUserId(userId);
            savedMood = moodRepository.save(mood);
        }

        String moodMessage = "Today's mood is '" + mood.getEmoji() + "', with sub-feeling '" + mood.getSubMood() + "'.";
        List<ChatLog> history = chatLogRepository.findByUserIdOrderByTimestampAsc(userId);

        return openAiService.sendMessageToOpenAI(history, moodMessage, userId)
                .flatMap(response -> openAiService.saveChatLog(userId, moodMessage, response)
                        .thenReturn(Map.of("mood", savedMood, "reply", response))
                )
                .onErrorResume(e -> Mono.just(Map.of("mood", savedMood, "reply", "(Chatbot response error)")));
    }

    /** Aggregate stats */
    public Map<String, Object> getMoodStatistics(String userId) {
        List<Mood> moods = moodRepository.findByUserId(userId);

        // Main mood stats
        Map<String, Integer> moodCounts = new HashMap<>();
        for (String mood : MOOD_MAP.keySet()) {
            moodCounts.put(mood, (int) moods.stream().filter(m -> mood.equals(m.getEmoji())).count());
        }
        int totalMoods = moodCounts.values().stream().mapToInt(Integer::intValue).sum();
        Map<String, Double> moodPercentages = new HashMap<>();
        for (Map.Entry<String, Integer> entry : moodCounts.entrySet()) {
            double percentage = totalMoods == 0 ? 0.0 : (entry.getValue() * 100.0) / totalMoods;
            moodPercentages.put(entry.getKey(), percentage);
        }

        // Submood stats
        Map<String, Integer> subMoodCounts = new HashMap<>();
        for (String mood : MOOD_MAP.keySet()) {
            for (String sub : MOOD_MAP.get(mood)) {
                String key = mood + ":" + sub;
                subMoodCounts.put(key, (int) moods.stream()
                        .filter(m -> mood.equals(m.getEmoji()) && sub.equals(m.getSubMood()))
                        .count());
            }
        }
        int totalSubMoods = subMoodCounts.values().stream().mapToInt(Integer::intValue).sum();
        Map<String, Double> subMoodPercentages = new HashMap<>();
        for (Map.Entry<String, Integer> entry : subMoodCounts.entrySet()) {
            double percentage = totalSubMoods == 0 ? 0.0 : (entry.getValue() * 100.0) / totalSubMoods;
            subMoodPercentages.put(entry.getKey(), percentage);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("mainMoodStats", moodPercentages);
        result.put("subMoodStats", subMoodPercentages);
        return result;
    }

    public List<Mood> getAllMoodsForUser(String userId) {
        return moodRepository.findByUserId(userId);
    }
}
