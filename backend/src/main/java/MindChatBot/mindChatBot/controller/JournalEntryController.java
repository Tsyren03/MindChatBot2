    package MindChatBot.mindChatBot.controller;

    import MindChatBot.mindChatBot.model.JournalEntry;
    import MindChatBot.mindChatBot.service.JournalEntryService;
    import org.springframework.beans.factory.annotation.Autowired;
    import org.springframework.format.annotation.DateTimeFormat;
    import org.springframework.http.HttpStatus;
    import org.springframework.security.core.Authentication;
    import org.springframework.security.core.context.SecurityContextHolder;
    import org.springframework.web.bind.annotation.*;
    import org.springframework.web.server.ResponseStatusException;
    import reactor.core.publisher.Mono;

    import java.time.LocalDate;
    import java.time.LocalDateTime;
    import java.util.*;

    @RestController
    @RequestMapping("/user/notes")
    public class JournalEntryController {

        private final JournalEntryService journalEntryService;

        @Autowired
        public JournalEntryController(JournalEntryService journalEntryService) {
            this.journalEntryService = journalEntryService;
        }

        @GetMapping(produces = "application/json")
        public List<JournalEntry> getNotes(
                @RequestParam(required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
            String userId = auth.getName();

            return (date != null)
                    ? journalEntryService.getEntriesForUserByDate(userId, date)
                    : journalEntryService.getAllEntriesForUser(userId);
        }

        @PostMapping(consumes = "application/json", produces = "application/json")
        public Mono<Map<String, Object>> createNote(@RequestBody JournalEntry note) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
            String userId = auth.getName();

            if (note == null || note.getContent() == null || note.getContent().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
            }

            note.setUserId(userId);
            if (note.getDate() == null) note.setDate(LocalDate.now());
            note.setTimestamp(LocalDateTime.now());

            return journalEntryService.saveEntryWithReply(note)
                    .map(result -> {
                        Map<String, Object> out = new HashMap<>();
                        out.put("note", result.get("note"));
                        out.put("reply", result.getOrDefault("reply", "Your note was saved."));

                        Object savedMood = result.get("savedMood");
                        if (savedMood != null) out.put("mood", savedMood);
                        return out;
                    });
        }

        @GetMapping(path = "/all", produces = "application/json")
        public List<JournalEntry> getAllNotes() {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
            String userId = auth.getName();
            return journalEntryService.getAllEntriesForUser(userId);
        }
    }
