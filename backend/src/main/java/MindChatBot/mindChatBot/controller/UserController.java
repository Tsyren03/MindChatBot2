package MindChatBot.mindChatBot.controller;

// imports to add:
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import MindChatBot.mindChatBot.model.User;
import MindChatBot.mindChatBot.repository.UserRepository;
import MindChatBot.mindChatBot.dto.AddUserRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.view.RedirectView;

import java.io.File;
import java.io.IOException;
import java.security.Principal;
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
        // Never cache this response, or identity detection may show the previous user
        CacheControl noStore = CacheControl.noStore();

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .cacheControl(noStore)
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .header(HttpHeaders.EXPIRES, "0")
                    .body(Map.of("error", "Not logged in"));
        }

        User user = userRepository.findByEmail(userDetails.getUsername()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .cacheControl(noStore)
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .header(HttpHeaders.EXPIRES, "0")
                    .body(Map.of("error", "User not found"));
        }

        // Prefer a stable unique ID if your User entity has it
        String id = user.getId(); // adjust if your id getter is different
        // Depending on your entity, the display name might be getUsername() or getName()
        String displayName = (user.getUsername() != null) ? user.getUsername() : user.getName();

        Map<String, Object> body = new HashMap<>();
        body.put("id", id);                        // <-- used by the frontend to isolate storage
        body.put("email", user.getEmail());
        body.put("username", displayName);
        body.put("joined", user.getCreatedAt() != null ? user.getCreatedAt().toString().substring(0, 10) : "-");

        return ResponseEntity.ok()
                .cacheControl(noStore)
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header(HttpHeaders.EXPIRES, "0")
                .body(body);
    }


    @PostMapping("/user/register")
    public String register(@ModelAttribute AddUserRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            return "redirect:/signup?error=exists";
        }
        User user = User.builder()
                .email(request.getEmail())
                .username(request.getName())
                .password(passwordEncoder.encode(request.getPassword())) // 비밀번호 암호화
                .createdAt(java.time.LocalDateTime.now())
                .build();
        userRepository.save(user);
        return "redirect:/login";
    }

    @PostMapping("/user/profile/upload-image")
    @ResponseBody
    public Map<String, String> uploadProfileImage(@RequestParam("profilePic") MultipartFile file, Principal principal) throws IOException {
        Map<String, String> result = new HashMap<>();
        if (principal == null) {
            result.put("error", "Not logged in");
            return result;
        }
        if (file == null || file.isEmpty()) {
            result.put("error", "No file uploaded");
            return result;
        }
        String userEmail = principal.getName();
        String uploadDir = "src/main/resources/static/uploads/profile-images/";
        File dir = new File(uploadDir);
        if (!dir.exists()) dir.mkdirs();
        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename());
        String filename = userEmail + "_" + System.currentTimeMillis() + "_" + originalFilename;
        File dest = new File(dir, filename);
        file.transferTo(dest);
        // (선택) DB에 이미지 경로 저장: /uploads/profile-images/filename
        // ... User 엔티티에 profileImageUrl 필드가 있다면 저장 로직 추가 ...
        result.put("imageUrl", "/uploads/profile-images/" + filename);
        return result;
    }
}
