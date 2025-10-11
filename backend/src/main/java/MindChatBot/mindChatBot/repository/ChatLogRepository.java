package MindChatBot.mindChatBot.repository;

import MindChatBot.mindChatBot.model.ChatLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

@Repository
public interface ChatLogRepository extends MongoRepository<ChatLog, String> {

    List<ChatLog> findByUserIdOrderByTimestampAsc(String userId);

    long countByUserIdAndTimestampAfter(String userId, LocalDateTime timestamp);

}

