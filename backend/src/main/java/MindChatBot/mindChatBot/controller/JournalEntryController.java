// JournalEntryController.java
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/user/notes")
public class JournalEntryController {

    private final JournalEntryService journalEntryService;

    @Autowired
    public JournalEntryController(JournalEntryService journalEntryService) {
        this.journalEntryService = journalEntryService;
    }

    // ✅ Get all notes or filter by a specific date (yyyy-MM-dd)
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

    // ✅ Create a new journal entry → AI analyze → save mood (if valid) → return single reply + mood payload
    @PostMapping(consumes = "application/json", produces = "application/json")
    public Mono<Map<String, Object>> createNote(@RequestBody JournalEntry note) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String userId = auth.getName();

        if (note == null || note.getContent() == null || note.getContent().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content is required");
        }

        // Ensure ownership + sane defaults
        note.setUserId(userId);
        if (note.getDate() == null) note.setDate(LocalDate.now());
        note.setTimestamp(LocalDateTime.now());

        // Service returns: { note, savedMood?, reply }
        // For backward compatibility, map savedMood -> mood (what the JS expects)
        return journalEntryService.saveEntryWithReply(note)
                .map(result -> {
                    Map<String, Object> out = new HashMap<>();
                    out.put("note", result.get("note"));
                    out.put("reply", result.getOrDefault("reply", "Your note was saved."));

                    Object savedMood = result.get("savedMood");
                    if (savedMood != null) {
                        // keep old response shape for the front-end
                        out.put("mood", savedMood);
                    }
                    return out;
                });
    }

    // ✅ Convenience: get all for current user
    @GetMapping(path = "/all", produces = "application/json")
    public List<JournalEntry> getAllNotes() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String userId = auth.getName();
        return journalEntryService.getAllEntriesForUser(userId);
    }
}
