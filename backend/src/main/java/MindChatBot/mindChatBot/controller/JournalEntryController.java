package MindChatBot.mindChatBot.controller;

import MindChatBot.mindChatBot.model.JournalEntry;
import MindChatBot.mindChatBot.service.JournalEntryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/user/notes")
public class JournalEntryController {

    private final JournalEntryService journalEntryService;

    @Autowired
    public JournalEntryController(JournalEntryService journalEntryService) {
        this.journalEntryService = journalEntryService;
    }

    // ✅ 1. Get all notes or filter by date
    @GetMapping
    public List<JournalEntry> getNotes(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        // Retrieve the currently authenticated user's ID
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();

        if (date != null) {
            // Return notes for the specific date
            return journalEntryService.getEntriesForUserByDate(userId, date);
        } else {
            // Return all notes for the user
            return journalEntryService.getAllEntriesForUser(userId);
        }
    }

    // ✅ 2. Create a new journal entry (note)
    @PostMapping
    public Mono<java.util.Map<String, Object>> createNote(@RequestBody JournalEntry note) {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        note.setUserId(userId);
        note.setTimestamp(LocalDateTime.now());
        return journalEntryService.saveEntryWithReply(note);
    }

    @GetMapping("/all")
    public List<JournalEntry> getAllNotes() {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        return journalEntryService.getAllEntriesForUser(userId);
    }
}
