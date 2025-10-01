package MindChatBot.mindChatBot.controller;

import MindChatBot.mindChatBot.dto.AddUserRequest;
import MindChatBot.mindChatBot.model.User;
import MindChatBot.mindChatBot.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Controller
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BCryptPasswordEncoder passwordEncoder;

    @GetMapping(value = "/user/profile", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getProfile(@AuthenticationPrincipal UserDetails userDetails) {
        // Never cache this response
        CacheControl noStore = CacheControl.noStore();

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .cacheControl(noStore)
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .header(HttpHeaders.EXPIRES, "0")
                    .body(Map.of("error", "Not logged in"));
        }

        // In security, getUsername() returns the login identifier (email in our app)
        User user = userRepository.findByEmail(userDetails.getUsername()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .cacheControl(noStore)
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .header(HttpHeaders.EXPIRES, "0")
                    .body(Map.of("error", "User not found"));
        }

        String id = user.getId();

        // Prefer the real name; if missing, fall back to the local-part of the email.
        String email = user.getEmail();
        String displayName = (user.getName() != null && !user.getName().isBlank())
                ? user.getName().trim()
                : (email != null ? email.replaceFirst("@.*$", "") : "");

        String joined = "-";
        if (user.getCreatedAt() != null) {
            // ISO local date (yyyy-MM-dd)
            joined = user.getCreatedAt().toString().substring(0, 10);
        }

        Map<String, Object> body = new HashMap<>();
        body.put("id", id);
        body.put("email", email);
        body.put("name", displayName);   // <-- frontend expects "name"
        body.put("joined", joined);

        return ResponseEntity.ok()
                .cacheControl(noStore)
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(body);
    }

    @PostMapping("/user/register")
    public String register(@ModelAttribute AddUserRequest request) {
        // Normalize & validate
        String rawEmail = request.getEmail() == null ? "" : request.getEmail().trim();
        String email = rawEmail.toLowerCase();
        String name = request.getName() == null ? "" : request.getName().trim();
        String password = request.getPassword() == null ? "" : request.getPassword();

        if (email.isBlank() || password.isBlank() || name.isBlank()) {
            return "redirect:/signup?error=invalid";
        }

        if (userRepository.findByEmail(email).isPresent()) {
            return "redirect:/signup?error=exists";
        }

        User user = User.builder()
                .email(email)
                .name(name) // <-- store real display name
                // If you kept a legacy "username" field for backward-compat,
                // you can also set it here by uncommenting the next line:
                // .username(name)
                .password(passwordEncoder.encode(password))
                .createdAt(LocalDateTime.now())
                .build();

        userRepository.save(user);
        return "redirect:/login";
    }

    @PostMapping("/user/profile/upload-image")
    @ResponseBody
    public Map<String, String> uploadProfileImage(@RequestParam("profilePic") MultipartFile file,
                                                  @AuthenticationPrincipal UserDetails principal) throws IOException {
        Map<String, String> result = new HashMap<>();
        if (principal == null) {
            result.put("error", "Not logged in");
            return result;
        }
        if (file == null || file.isEmpty()) {
            result.put("error", "No file uploaded");
            return result;
        }

        // Use authenticated email as prefix
        String userEmail = principal.getUsername(); // email
        String uploadDir = "src/main/resources/static/uploads/profile-images/";
        File dir = new File(uploadDir);
        if (!dir.exists()) dir.mkdirs();

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String safePrefix = userEmail.replaceAll("[^a-zA-Z0-9._-]", "_");
        String filename = safePrefix + "_" + System.currentTimeMillis() + "_" + originalFilename;

        File dest = new File(dir, filename);
        file.transferTo(dest);

        // Optional: persist profileImageUrl in User (add field in entity & repository update)
        // user.setProfileImageUrl("/uploads/profile-images/" + filename);
        // userRepository.save(user);

        result.put("imageUrl", "/uploads/profile-images/" + filename);
        return result;
    }
}
