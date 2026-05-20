import re
import os

file_path = "/Users/louismusolff/Anfragen Manger/stollberg/verkauf.html"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 2 Theme/shared.css paths (do this early before other string changes)
content = content.replace('href="shared.css"', 'href="../shared.css"')
content = content.replace('src="theme.js"', 'src="../theme.js"')

# 1 & 5 & 8 & 10 Branding & Titles
content = content.replace("<title>IAV Möbel Verkauf</title>", "<title>IAV Möbelmarkt Stollberg</title>")
content = content.replace("<title>IAV Möbelmarkt</title>", "<title>IAV Möbelmarkt Stollberg</title>")
content = content.replace("IAV Möbel Verkauf", "IAV Möbelmarkt Stollberg")

# Replace IAV Möbelmarkt if not followed by Stollberg (lookahead)
content = re.sub(r"IAV Möbelmarkt(?! Stollberg)", "IAV Möbelmarkt Stollberg", content)

# 3 Firebase data paths
content = content.replace("'moebelDropdownKatalog'", "'stollbergMoebelDropdownKatalog'")
content = content.replace('"moebelDropdownKatalog"', '"stollbergMoebelDropdownKatalog"')

# .ref('moebel')
content = re.sub(r"\.ref\(['\"]moebel['\"]\)", ".ref('stollbergMoebel')", content)

content = content.replace("'sessions'", "'stollbergSessions'")
content = content.replace('"sessions"', '"stollbergSessions"')
content = content.replace("'verkaufAnfragen'", "'stollbergVerkaufAnfragen'")
content = content.replace('"verkaufAnfragen"', '"stollbergVerkaufAnfragen"')

# 4 API endpoint
content = content.replace("/api/sendConfirmation", "/api/stollberg/sendConfirmation")

# 5, 6, 7 Text changes (Louis/Rohat)
content = content.replace("Louis Musolff &amp; Rohat Turgut", "das Stollberg-Team")
content = content.replace("Louis Musolff & Rohat Turgut", "das Stollberg-Team")
content = content.replace("Louis oder Rohat schauen sich", "Unser Team schaut sich")
content = content.replace("Louis oder Rohat", "unser Team")
content = content.replace("für Louis oder Rohat", "für unser Team")
content = content.replace("an Louis Musolff", "an das Stollberg-Team")
content = content.replace("auf Microsoft Teams", "per E-Mail oder Telefon")

# Generic "Louis" or "Rohat" by name (capitalized, not followed by .musolff should stay)
# We want to keep emails: louis.musolff@iav.de,rohat.turgut@iav.de
# The emails are likely in JS or data- attributes. 
# Usually they are lowercase in emails. 
# Let's replace uppercase "Louis" and "Rohat" that are not part of an email.
content = re.sub(r"\bLouis\b", "das Team", content)
content = re.sub(r"\bRohat\b", "ein Mitarbeiter", content)

# 5 Keys
content = content.replace("iavMyVkIds", "stollbergMyVkIds")
content = content.replace("verkauf_my_mail", "stollbergVerkaufMyMail")
content = content.replace("name@iav.de", "name@example.de")

# 9 Footer/Generic branding
content = content.replace("IAV Anfragen-Manager", "Anfragen-Manager")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
