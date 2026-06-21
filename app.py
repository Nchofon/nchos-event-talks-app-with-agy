import re
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_entry_content(html_content):
    if not html_content:
        return []
    
    # Find all <h3>TYPE</h3> headings
    matches = list(re.finditer(r'<h3>(.*?)</h3>', html_content))
    updates = []
    
    if not matches:
        # If there are no <h3> tags, treat the entire content as one general update
        updates.append({
            "type": "General",
            "html": html_content.strip()
        })
        return updates
        
    for i, match in enumerate(matches):
        update_type = match.group(1).strip()
        start_pos = match.end()
        end_pos = matches[i+1].start() if i + 1 < len(matches) else len(html_content)
        update_html = html_content[start_pos:end_pos].strip()
        updates.append({
            "type": update_type,
            "html": update_html
        })
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries_data = []
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns)
            date_str = title.text if title is not None else "Unknown Date"
            
            entry_id = entry.find('atom:id', ns)
            id_str = entry_id.text if entry_id is not None else ""
            
            updated = entry.find('atom:updated', ns)
            updated_str = updated.text if updated is not None else ""
            
            # Find the alternate link
            link = entry.find("atom:link[@rel='alternate']", ns)
            if link is None:
                link = entry.find("atom:link", ns)
            href_str = link.attrib.get('href', '') if link is not None else ""
            
            content_elem = entry.find('atom:content', ns)
            content_html = content_elem.text if content_elem is not None else ""
            
            sub_updates = parse_entry_content(content_html)
            
            entries_data.append({
                "date": date_str,
                "id": id_str,
                "updated": updated_str,
                "link": href_str,
                "updates": sub_updates
            })
            
        return jsonify({
            "status": "success",
            "data": entries_data
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
