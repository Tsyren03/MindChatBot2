package MindChatBot.mindChatBot.repository;

import MindChatBot.mindChatBot.model.ChatLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

import java.util.List;

@Repository
public interface ChatLogRepository extends MongoRepository<ChatLog, String> {
    List<ChatLog> findByUserIdOrderByTimestampAsc(String userId);
}
