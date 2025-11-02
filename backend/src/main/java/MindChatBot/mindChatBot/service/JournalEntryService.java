    package MindChatBot.mindChatBot.service;

    import MindChatBot.mindChatBot.model.JournalEntry;
    import MindChatBot.mindChatBot.repository.JournalEntryRepository;
    import org.springframework.beans.factory.annotation.Autowired;
    import org.springframework.data.domain.PageRequest;
    import org.springframework.stereotype.Service;
    import reactor.core.publisher.Mono;

    import java.time.LocalDate;
    import java.util.HashMap;
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

        // ---- Queries ----
        public List<JournalEntry> getAllEntriesForUser(String userId) {
            return journalEntryRepository.findByUserId(userId);
        }

        public Optional<JournalEntry> getEntryByUserAndDate(String userId, LocalDate date) {
            return journalEntryRepository.findByUserIdAndDate(userId, date);
        }

        public List<JournalEntry> getEntriesForUserByDate(String userId, LocalDate date) {
            return journalEntryRepository.findAllByUserIdAndDate(userId, date);
        }

        public List<JournalEntry> getRecentEntries(String userId, int limit) {
            return journalEntryRepository
                    .findByUserIdOrderByTimestampDesc(userId, PageRequest.of(0, limit))
                    .getContent();
        }

        public JournalEntry saveEntry(JournalEntry journalEntry) {
            return journalEntryRepository.save(journalEntry);
        }

        // ---- Save entry, analyze mood, save mood, return single reply ----
        public Mono<Map<String, Object>> saveEntryWithReply(JournalEntry journalEntry) {
            // Persist note first (blocking repo)
            JournalEntry saved = journalEntryRepository.save(journalEntry);

            final String userId = saved.getUserId();
            final String noteContent = saved.getContent() == null ? "" : saved.getContent();
            final LocalDate noteDate = saved.getDate() != null ? saved.getDate() : LocalDate.now();

            // Ask OpenAI to classify mood
            return openAiService.analyzeMoodFromNote(noteContent)
                    .flatMap(moodMap -> {
                        // Validate mood
                        String main = moodMap.get("main");
                        String sub  = moodMap.get("sub");

                        Map<String, List<String>> MOOD_MAP = Map.of(
                                "best",    List.of("proud", "grateful", "energetic", "excited", "fulfilled"),
                                "good",    List.of("calm", "productive", "hopeful", "motivated", "friendly"),
                                "neutral", List.of("indifferent", "blank", "tired", "bored", "quiet"),
                                "poor",    List.of("frustrated", "overwhelmed", "nervous", "insecure", "confused"),
                                "bad",     List.of("angry", "sad", "lonely", "anxious", "hopeless")
                        );

                        boolean valid = main != null && sub != null
                                && MOOD_MAP.containsKey(main)
                                && MOOD_MAP.get(main).contains(sub);

                        if (!valid) {
                            // Return note + gentle reply; no mood saved
                            Map<String, Object> out = new HashMap<>();
                            out.put("note", saved);
                            out.put("reply", "Your note was saved. I couldn’t confidently classify a mood this time.");
                            return Mono.just(out);
                        }

                        // Save/Update mood on calendar (wrap blocking call)
                        return Mono.fromCallable(() -> {
                            // Ensure your MoodService has this signature:
                            // void saveOrUpdateMood(String userId, int year, int month, int day, String main, String sub)
                            moodService.saveOrUpdateMood(
                                    userId,
                                    noteDate.getYear(),
                                    noteDate.getMonthValue(),
                                    noteDate.getDayOfMonth(),
                                    main,
                                    sub
                            );

                            Map<String, Object> out = new HashMap<>();
                            out.put("note", saved);
                            out.put("savedMood", Map.of(
                                    "main",  main,
                                    "sub",   sub,
                                    "year",  noteDate.getYear(),
                                    "month", noteDate.getMonthValue(),
                                    "day",   noteDate.getDayOfMonth()
                            ));
                            out.put("reply", String.format(
                                    "Saved your note and marked %s / %s for %s.",
                                    main, sub, noteDate.toString()
                            ));
                            return out;
                        });
                    })
                    .onErrorResume(err -> {
                        // Never 500 to the client—still return the note with a safe reply
                        Map<String, Object> out = new HashMap<>();
                        out.put("note", saved);
                        out.put("reply", "Your note was saved, but mood analysis/saving failed. You can set the mood manually.");
                        return Mono.just(out);
                    });
        }
    }
