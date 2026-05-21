import re

with open('node_modules/sonner/dist/index.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'__insertCSS\s*\(\s*[`"\'](.*?)[`"\']\s*\)', content, re.DOTALL)
if m:
    css = m.group(1)
    # Find all !important
    count = css.count('!important')
    print(f'Found {count} !important in Sonner CSS')
    # Show context around each
    for match in re.finditer(r'!important', css):
        start = max(0, match.start() - 100)
        end = min(len(css), match.end() + 50)
        print(f'  ...{css[start:end]}...')
