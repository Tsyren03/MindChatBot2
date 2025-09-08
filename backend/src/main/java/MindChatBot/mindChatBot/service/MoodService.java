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

    // Emoji → SubMood map
    private static final Map<String, List<String>> MOOD_MAP = Map.of(
            "best", List.of("proud", "grateful", "energetic", "excited", "fulfilled"),
            "good", List.of("calm", "productive", "hopeful", "motivated", "friendly"),
            "neutral", List.of("indifferent", "blank", "tired", "bored", "quiet"),
            "poor", List.of("frustrated", "overwhelmed", "nervous", "insecure", "confused"),
            "bad", List.of("angry", "sad", "lonely", "anxious", "hopeless")
    );

    public List<Mood> getMoodsByMonth(String userId, int year, int month) {
        return moodRepository.findByUserIdAndYearAndMonth(userId, year, month);
    }

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
                subMoodCounts.put(key, (int) moods.stream().filter(m -> mood.equals(m.getEmoji()) && sub.equals(m.getSubMood())).count());
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
