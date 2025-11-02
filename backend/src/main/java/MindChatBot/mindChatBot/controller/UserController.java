// src/main/java/MindChatBot/mindChatBot/controller/UserController.java
package MindChatBot.mindChatBot.controller;

import MindChatBot.mindChatBot.dto.AddUserRequest;
import MindChatBot.mindChatBot.model.User;
import MindChatBot.mindChatBot.repository.UserRepository;
import MindChatBot.mindChatBot.service.EmailService;
import MindChatBot.mindChatBot.service.UserDetailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.web.util.UriUtils;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Controller
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final UserDetailService userDetailService;
    private final long CODE_EXPIRATION_MINUTES = 10; // Set expiration time

    private String generateCode() {
        return String.format("%06d", ThreadLocalRandom.current().nextInt(100000, 1000000));
    }

    private void updateUserWithCode(User user, String code) {
        user.setVerificationCode(code);
        user.setVerificationCodeExpiresAt(LocalDateTime.now().plusMinutes(CODE_EXPIRATION_MINUTES));
    }

    /* ---------- STEP 1: JSON (AJAX) ---------- */
    @PostMapping(value = "/signup", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, String>> initiateSignupJson(@RequestBody AddUserRequest request) {
        final String email = request.getEmail().toLowerCase().trim();
        log.info("AJAX signup attempt for {}", email);

        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent() && existing.get().isVerified()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "An account with this email already exists."));
        }

        String code = generateCode();
        User user = existing.orElseGet(User::new);
        user.setEmail(email);
        user.setName(Optional.ofNullable(request.getName()).orElse("").trim());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        updateUserWithCode(user, code); // Use helper method
        user.setVerified(false);
        if (user.getCreatedAt() == null) user.setCreatedAt(LocalDateTime.now());

        userRepository.save(user);
        emailService.sendVerificationCode(email, code);

        return ResponseEntity.ok(Map.of("confirmationId", email));
    }

    /* ---------- STEP 1: HTML form fallback ---------- */
    @PostMapping(value = "/signup", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public String initiateSignupForm(AddUserRequest request) {
        final String email = request.getEmail().toLowerCase().trim();
        log.info("FORM signup attempt for {}", email);

        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent() && existing.get().isVerified()) {
            return "redirect:/signup?error=exists";
        }

        String code = generateCode();
        User user = existing.orElseGet(User::new);
        user.setEmail(email);
        user.setName(Optional.ofNullable(request.getName()).orElse("").trim());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        updateUserWithCode(user, code); // Use helper method
        user.setVerified(false);
        if (user.getCreatedAt() == null) user.setCreatedAt(LocalDateTime.now());

        userRepository.save(user);
        emailService.sendVerificationCode(email, code);

        return "redirect:/signup?email=" + UriUtils.encode(email, StandardCharsets.UTF_8);
    }

    /* ---------- STEP 2: verify code ---------- */
    @PostMapping("/verify")
    public String verifyRegistration(@RequestParam("email") String email,
                                     @RequestParam("verificationCode") String code) {
        Optional<User> opt = userRepository.findByEmail(email.toLowerCase().trim());
        if (opt.isEmpty()) return "redirect:/signup?error=notFound";

        User user = opt.get();
        if (user.isVerified()) return "redirect:/login?verified=true";

        // Check code and expiration
        if (Objects.equals(user.getVerificationCode(), code) &&
                user.getVerificationCodeExpiresAt().isAfter(LocalDateTime.now())) {
            user.setVerified(true);
            user.setVerificationCode(null);
            user.setVerificationCodeExpiresAt(null);
            userRepository.save(user);
            return "redirect:/login?success=true";
        }
        return "redirect:/signup?error=invalidCode&email=" + UriUtils.encode(email, StandardCharsets.UTF_8);
    }

    /* ---------- Resend code (AJAX) ---------- */
    @PostMapping(value = "/resend-code", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Void> resendCode(@RequestBody Map<String, String> payload) {
        String email = Optional.ofNullable(payload.get("email")).orElse("").trim().toLowerCase();
        Optional<User> opt = userRepository.findByEmail(email);
        if (opt.isPresent() && !opt.get().isVerified()) {
            String code = generateCode();
            User u = opt.get();
            updateUserWithCode(u, code); // Use helper method
            userRepository.save(u);
            emailService.sendVerificationCode(email, code);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
    }

    // --- NEW ENDPOINTS FOR PASSWORD RESET ---

    @PostMapping(value = "/forgot-password", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<?> handleForgotPassword(@RequestBody Map<String, String> payload) {
        String email = payload.get("email").toLowerCase().trim();
        log.info("Password reset request for {}", email);

        Optional<User> optUser = userRepository.findByEmail(email);
        if (optUser.isEmpty()) {
            // Return 404 to be handled by JS, but log it for security awareness
            log.warn("Password reset attempt for non-existent email: {}", email);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        User user = optUser.get();
        String code = generateCode();
        updateUserWithCode(user, code); // Reuse helper method
        userRepository.save(user);

        emailService.sendPasswordResetCode(email, code);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public String handleResetPassword(@RequestParam String email,
                                      @RequestParam String code,
                                      @RequestParam String password,
                                      @RequestParam String lang,
                                      RedirectAttributes redirectAttributes) {

        log.info("Attempting to reset password for {}", email);
        Optional<User> optUser = userRepository.findByEmail(email.toLowerCase().trim());

        // Prepare redirect attributes for both success and failure cases
        redirectAttributes.addAttribute("lang", lang);

        if (optUser.isEmpty()) {
            redirectAttributes.addAttribute("error", "An unexpected error occurred.");
            return "redirect:/forgot-password";
        }

        User user = optUser.get();

        // Check if code is valid and not expired
        if (user.getVerificationCode() == null ||
                !user.getVerificationCode().equals(code) ||
                user.getVerificationCodeExpiresAt().isBefore(LocalDateTime.now())) {

            log.warn("Invalid or expired password reset code for {}", email);
            redirectAttributes.addAttribute("email", email);
            redirectAttributes.addAttribute("error", "The code is invalid or has expired.");
            return "redirect:/reset-password";
        }

        // Success: update password, clear code, and redirect to login
        user.setPassword(passwordEncoder.encode(password));
        user.setVerificationCode(null);
        user.setVerificationCodeExpiresAt(null);
        userRepository.save(user);

        log.info("Password successfully reset for {}", email);
        redirectAttributes.addAttribute("reset_success", true);
        return "redirect:/login";
    }

    /* ---------- Profile APIs (No changes needed here) ---------- */
    // ... your existing getProfile and uploadProfileImage methods ...


    //
    // --- THIS IS THE CORRECTED METHOD THAT FIXES THE 500 ERROR ---
    //
    /**
     * Safely gets the profile of the currently authenticated user.
     * This method is called by the frontend to get the user's ID.
     */
    @GetMapping("/user/profile")
    @ResponseBody
    public ResponseEntity<User> getUserProfile(Authentication authentication) {

        // 1. Check if authentication exists and is valid
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            // No user is logged in
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        // 2. Get the username (which is the email in your setup) from the authenticated principal.
        //    auth.getName() is the safest way to get this.
        String username = authentication.getName();

        // 3. Now, use the UserRepository (which is already injected) to find the full User object.
        Optional<User> userOpt = userRepository.findByEmail(username);

        // 4. Return the user if found
        if (userOpt.isPresent()) {
            return ResponseEntity.ok(userOpt.get());
        } else {
            // This should not happen if they are authenticated, but it's a good safeguard.
            log.warn("Authenticated user '{}' not found in repository.", username);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}