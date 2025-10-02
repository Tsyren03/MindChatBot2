package MindChatBot.mindChatBot.controller;

import MindChatBot.mindChatBot.dto.AddUserRequest;
import MindChatBot.mindChatBot.model.User;
import MindChatBot.mindChatBot.repository.UserRepository;
import MindChatBot.mindChatBot.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
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

    private String generateCode() {
        return String.format("%06d", ThreadLocalRandom.current().nextInt(100000, 1000000));
    }

    /* ---------- STEP 1: JSON (AJAX) ---------- */
    @PostMapping(value = "/signup", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, String>> initiateSignupJson(@RequestBody AddUserRequest request) {
        final String email = request.getEmail().toLowerCase().trim();
        log.info("AJAX signup attempt for {}", email);

        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent() && existing.get().isVerified()) {
            // Return a friendly string (frontend shows this directly).
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "An account with this email already exists."));
        }

        String code = generateCode();

        User user = existing.orElseGet(User::new);
        user.setEmail(email);
        user.setName(Optional.ofNullable(request.getName()).orElse("").trim());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setVerificationCode(code);
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
        user.setVerificationCode(code);
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

        if (Objects.equals(user.getVerificationCode(), code)) {
            user.setVerified(true);
            user.setVerificationCode(null);
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
            u.setVerificationCode(code);
            userRepository.save(u);
            emailService.sendVerificationCode(email, code);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
    }

    /* ---------- Profile APIs ---------- */
    @GetMapping(value = "/user/profile", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getProfile(@org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.core.userdetails.UserDetails principal) {
        if (principal == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .cacheControl(CacheControl.noStore())
                    .body(Map.of("error", "Not logged in"));
        }
        User user = userRepository.findByEmail(principal.getUsername()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .cacheControl(CacheControl.noStore())
                    .body(Map.of("error", "User not found"));
        }
        String joined = user.getCreatedAt() != null ? user.getCreatedAt().toString().substring(0, 10) : "-";
        Map<String, Object> body = new HashMap<>();
        body.put("id", user.getId());
        body.put("email", user.getEmail());
        body.put("name", user.getNameSafe());
        body.put("joined", joined);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    @PostMapping("/user/profile/upload-image")
    @ResponseBody
    public Map<String, String> uploadProfileImage(@RequestParam("profilePic") MultipartFile file,
                                                  @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.core.userdetails.UserDetails principal) throws IOException {
        Map<String, String> result = new HashMap<>();
        if (principal == null) { result.put("error", "Not logged in"); return result; }
        if (file == null || file.isEmpty()) { result.put("error", "No file uploaded"); return result; }

        String userEmail = principal.getUsername();
        String uploadDir = "src/main/resources/static/uploads/profile-images/";
        File dir = new File(uploadDir);
        if (!dir.exists()) dir.mkdirs();

        String originalFilename = org.springframework.util.StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
        String safePrefix = userEmail.replaceAll("[^a-zA-Z0-9._-]", "_");
        String filename = safePrefix + "_" + System.currentTimeMillis() + "_" + originalFilename;

        File dest = new File(dir, filename);
        file.transferTo(dest);

        result.put("imageUrl", "/uploads/profile-images/" + filename);
        return result;
    }
}
