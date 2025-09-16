// ViewController.java
package MindChatBot.mindChatBot.controller;

import lombok.RequiredArgsConstructor;
import MindChatBot.mindChatBot.service.UserService;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@RequiredArgsConstructor
@Controller
public class ViewController {
    private final UserService userService;

    // Main
    @GetMapping({"/index", "/user", "/user/index"})
    public String mainPage() {
        return "index"; // templates/index.html
    }

    // Back-compat for direct .html hits
    @GetMapping("/index.html")
    public String redirectIndexHtml() { return "redirect:/index"; }

    // Auth pages
    @GetMapping("/login")
    public String login() { return "login"; }     // templates/login.html

    @GetMapping("/signup")
    public String signup() { return "signup"; }   // templates/signup.html

    // App pages (add these!)
    @GetMapping({"/notes", "/notes.html"})
    public String notes() { return "notes"; }     // templates/notes.html

    @GetMapping({"/statistics", "/statistics.html"})
    public String statistics() { return "statistics"; } // templates/statistics.html

    @GetMapping({"/home", "/home.html"})
    public String home() { return "home"; }       // templates/home.html

    // Root
    @GetMapping("/")
    public String root() {
        // pick one:
        // return "redirect:/index";
        return "redirect:/login";
    }
}
