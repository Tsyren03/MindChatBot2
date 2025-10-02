// src/main/java/MindChatBot/mindChatBot/service/EmailService.java
package MindChatBot.mindChatBot.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:no-reply@mindchatbot.app}")
    private String from;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /** Sends a plain-text email with the 6-digit verification code. */
    public void sendVerificationCode(String toEmail, String code) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(toEmail);
            message.setSubject("Your MindChatBot Verification Code");
            message.setText("""
                    Welcome to MindChatBot!

                    Your 6-digit verification code is: %s

                    This code expires in 10 minutes.
                    If you didn’t request this, you can ignore this email.
                    """.formatted(code));
            mailSender.send(message);
        } catch (Exception e) {
            log.error("Failed to send verification email to {}: {}", toEmail, e.getMessage(), e);
        }
    }
}
