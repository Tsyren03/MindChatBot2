    // JournalEntryRepository.java
    package MindChatBot.mindChatBot.repository;

    import MindChatBot.mindChatBot.model.JournalEntry;
    import org.springframework.data.domain.Page;
    import org.springframework.data.domain.Pageable;
    import org.springframework.data.mongodb.repository.MongoRepository;

    import java.time.LocalDate;
    import java.util.List;
    import java.util.Optional;

    public interface JournalEntryRepository extends MongoRepository<JournalEntry, String> {
        List<JournalEntry> findByUserId(String userId);
        Optional<JournalEntry> findByUserIdAndDate(String userId, LocalDate date);
        List<JournalEntry> findAllByUserIdAndDate(String userId, LocalDate date);
        Page<JournalEntry> findByUserIdOrderByTimestampDesc(String userId, Pageable pageable);
    }
