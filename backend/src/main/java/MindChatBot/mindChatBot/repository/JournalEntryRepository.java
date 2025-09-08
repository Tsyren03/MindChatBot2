package MindChatBot.mindChatBot.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import MindChatBot.mindChatBot.model.JournalEntry;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface JournalEntryRepository extends MongoRepository<JournalEntry, String> {
    Page<JournalEntry> findByUserIdOrderByTimestampDesc(String userId, Pageable pageable);

    // Other repository methods (e.g., findByUserId, findByUserIdAndDate, etc.)
    List<JournalEntry> findByUserId(String userId);
    List<JournalEntry> findAllByUserIdAndDate(String userId, LocalDate date);
    Optional<JournalEntry> findByUserIdAndDate(String userId, LocalDate date);
}