// src/main/java/MindChatBot/mindChatBot/service/RegistrationOtpService.java
package MindChatBot.mindChatBot.service;

import MindChatBot.mindChatBot.model.User;
import MindChatBot.mindChatBot.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class RegistrationOtpService {

    private static final Duration CODE_TTL = Duration.ofMinutes(10);
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final UserRepository userRepository;
    private final EmailService emailService;

    public RegistrationOtpService(UserRepository userRepository, EmailService emailService) {
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    /** Issue (or re-issue) a 6-digit code and email it to the user. */
    public void issueCode(User user) {
        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
        LocalDateTime now = LocalDateTime.now();

        user.setVerificationCode(code);
        user.setVerificationCodeExpiresAt(now.plus(CODE_TTL));
        user.setLastVerificationCodeSentAt(now);
        user.setVerificationAttemptCount(0);
        user.setVerificationLockedUntil(null);

        userRepository.save(user);
        // Keep the 2-arg signature to match your current EmailService
        emailService.sendVerificationCode(user.getEmail(), code);
    }

    /** Whether a new code can be re-sent right now (cooldown respected). */
    public boolean canResend(User user) {
        LocalDateTime last = user.getLastVerificationCodeSentAt();
        return last == null || Duration.between(last, LocalDateTime.now()).compareTo(RESEND_COOLDOWN) >= 0;
    }

    /** How many seconds the client should wait before requesting another resend. */
    public long resendRetryAfterSeconds(User user) {
        LocalDateTime last = user.getLastVerificationCodeSentAt();
        if (last == null) return 0;
        long elapsed = Duration.between(last, LocalDateTime.now()).getSeconds();
        long remain = RESEND_COOLDOWN.getSeconds() - elapsed;
        return Math.max(0, remain);
    }

    /** Validate a submitted code and update the user state accordingly. */
    public VerificationResult verify(User user, String submittedCode) {
        LocalDateTime now = LocalDateTime.now();

        if (user.getVerificationLockedUntil() != null && now.isBefore(user.getVerificationLockedUntil())) {
            return VerificationResult.LOCKED;
        }
        if (user.getVerificationCode() == null || user.getVerificationCodeExpiresAt() == null) {
            return VerificationResult.NO_CODE;
        }
        if (now.isAfter(user.getVerificationCodeExpiresAt())) {
            return VerificationResult.EXPIRED;
        }
        if (!user.getVerificationCode().equals(submittedCode)) {
            int attempts = user.getVerificationAttemptCount() + 1;
            user.setVerificationAttemptCount(attempts);
            if (attempts >= MAX_ATTEMPTS) {
                user.setVerificationLockedUntil(now.plus(LOCK_DURATION));
            }
            userRepository.save(user);
            return attempts >= MAX_ATTEMPTS ? VerificationResult.LOCKED : VerificationResult.INVALID;
        }

        // success
        user.markVerified();
        userRepository.save(user);
        return VerificationResult.OK;
    }

    public enum VerificationResult {
        OK, INVALID, EXPIRED, NO_CODE, LOCKED
    }
}
