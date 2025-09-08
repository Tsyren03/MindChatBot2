package MindChatBot.mindChatBot.service;

import MindChatBot.mindChatBot.model.JournalEntry;
import MindChatBot.mindChatBot.model.Mood;
import MindChatBot.mindChatBot.repository.JournalEntryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class JournalEntryService {

    private final JournalEntryRepository journalEntryRepository;

    @Autowired
    private OpenAiService openAiService;

    @Autowired
    private MoodService moodService;

    @Autowired
    public JournalEntryService(JournalEntryRepository journalEntryRepository) {
        this.journalEntryRepository = journalEntryRepository;
    }

    // Get all journal entries for a specific user
    public List<JournalEntry> getAllEntriesForUser(String userId) {
        return journalEntryRepository.findByUserId(userId);
    }

    // Get a specific journal entry by userId and date (optional - for future use)
    public Optional<JournalEntry> getEntryByUserAndDate(String userId, LocalDate date) {
        return journalEntryRepository.findByUserIdAndDate(userId, date);
    }

    // Get all journal entries for a specific user on a specific date
    public List<JournalEntry> getEntriesForUserByDate(String userId, LocalDate date) {
        return journalEntryRepository.findAllByUserIdAndDate(userId, date);
    }

    // ✅ NEW: Get the most recent journal entries for a user
    public List<JournalEntry> getRecentEntries(String userId, int limit) {
        // Fetch the most recent entries up to the given limit
        return journalEntryRepository.findByUserIdOrderByTimestampDesc(userId, PageRequest.of(0, limit)).getContent();
    }

    // Optional: Save entry (used by controller directly)
    public JournalEntry saveEntry(JournalEntry journalEntry) {
        return journalEntryRepository.save(journalEntry);
    }

    public Mono<java.util.Map<String, Object>> saveEntryWithReply(JournalEntry journalEntry) {
        JournalEntry saved = journalEntryRepository.save(journalEntry);
        String userId = journalEntry.getUserId();
        String noteContent = journalEntry.getContent();
        LocalDate noteDate = journalEntry.getDate();
        return openAiService.analyzeMoodFromNote(noteContent)
            .flatMap(moodMap -> {
                // === Validate mood against MOOD_MAP ===
                String main = moodMap.get("main");
                String sub = moodMap.get("sub");
                Map<String, List<String>> MOOD_MAP = Map.of(
                    "best", List.of("proud", "grateful", "energetic", "excited", "fulfilled"),
                    "good", List.of("calm", "productive", "hopeful", "motivated", "friendly"),
                    "neutral", List.of("indifferent", "blank", "tired", "bored", "quiet"),
                    "poor", List.of("frustrated", "overwhelmed", "nervous", "insecure", "confused"),
                    "bad", List.of("angry", "sad", "lonely", "anxious", "hopeless")
                );
                boolean valid = main != null && sub != null && MOOD_MAP.containsKey(main) && MOOD_MAP.get(main).contains(sub);
                // === Only return mood if valid ===
                Map<String, Object> result = new java.util.HashMap<>();
                result.put("note", saved);
                if (valid) {
                    result.put("mood", Map.of(
                        "main", main,
                        "sub", sub,
                        "year", noteDate.getYear(),
                        "month", noteDate.getMonthValue(),
                        "day", noteDate.getDayOfMonth()
                    ));
                }
                return Mono.just(result);
            });
    }
}
