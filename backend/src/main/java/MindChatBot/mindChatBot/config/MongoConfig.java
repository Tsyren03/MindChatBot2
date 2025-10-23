package MindChatBot.mindChatBot.config;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.config.AbstractMongoClientConfiguration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.beans.factory.annotation.Value;

@Configuration
@EnableMongoRepositories(basePackages = "MindChatBot.mindChatBot.repository")
public class MongoConfig extends AbstractMongoClientConfiguration {

    // 1. Inject the connection URI from application.properties
    @Value("${spring.data.mongodb.uri}")
    private String mongoUri;

    @Override
    protected String getDatabaseName() {
        // 2. You can keep this constant, but it's better to get it from the URI if possible.
        // For Spring Data, returning the database name specified in your Atlas URI works.
        return "mindChatBotDB";
    }

    @Bean
    public MongoClient mongoClient() {
        // 3. Use the injected Atlas connection URI
        return MongoClients.create(mongoUri);
    }
}