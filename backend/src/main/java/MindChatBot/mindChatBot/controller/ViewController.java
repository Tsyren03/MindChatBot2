package MindChatBot.mindChatBot.controller;

import lombok.RequiredArgsConstructor;
import MindChatBot.mindChatBot.service.UserService;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@RequiredArgsConstructor
@Controller
public class ViewController {
    private final UserService userService;

    @GetMapping({"/index", "/user", "/user/index"})
    public String mainPage() {
        return "index";
    }

    @GetMapping("/index.html")
    public String redirectIndexHtml() {
        return "redirect:/index";
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @GetMapping("/signup")
    public String signup() {
        return "signup";
    }

    @GetMapping("/")
    public String root() {
        return "redirect:/login";
    }
}

