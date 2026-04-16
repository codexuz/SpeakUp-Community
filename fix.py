
with open('app/(student)/profile.tsx', 'r', encoding='utf-8') as f:
    text = f.read()
import re
text = re.sub(r'width:\s*\\\\\\$', 'width: ${', text)
text = re.sub(r'\}\\%\\\', '}%', text)
with open('app/(student)/profile.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

