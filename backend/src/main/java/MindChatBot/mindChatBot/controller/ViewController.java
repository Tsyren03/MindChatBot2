package MindChatBot.mindChatBot.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {

    @GetMapping({"/index", "/user", "/user/index"})
    public String mainPage() { return "index"; }

    @GetMapping("/index.html")  public String redirectIndexHtml()  { return "redirect:/index"; }
    @GetMapping("/login.html")  public String redirectLoginHtml()  { return "redirect:/login"; }
    @GetMapping("/signup.html") public String redirectSignupHtml() { return "redirect:/signup"; }

    @GetMapping("/login")  public String login()  { return "login"; }
    @GetMapping("/signup") public String signup() { return "signup"; }

    @GetMapping({"/notes", "/notes.html"})             public String notes()       { return "notes"; }
    @GetMapping({"/statistics", "/statistics.html"})   public String statistics()  { return "statistics"; }
    @GetMapping({"/home", "/home.html"})               public String home()        { return "home"; }

    @GetMapping("/") public String root() { return "redirect:/login"; }
}
