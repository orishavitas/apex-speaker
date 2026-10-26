import fitz  # PyMuPDF
import os
import re

pdf_path = r"C:\Users\OriShavit\Downloads\Loudspeaker_Design_Cookbook.pdf"
output_dir = r"C:\Users\OriShavit\Documents\GitHub\apex-speaker\docs\knowledge_base\LDC"
image_dir = os.path.join(output_dir, "images")

if not os.path.exists(image_dir):
    os.makedirs(image_dir)

# PDF page index starts at 0.
# Offset: Book page 3 is PDF page 14 (0-indexed).
# Offset = 11.
offset = 11

chapters = [
    {"name": "Introduction", "start": 6, "end": 11}, # PDF 6 to 11 (vii to xii)
    {"name": "Chapter 0 - How Loudspeakers Work", "start": 3 + offset, "end": 27 + offset}, 
    {"name": "Chapter 1 - Closed-Box Low-Frequency Systems", "start": 29 + offset, "end": 59 + offset},
    {"name": "Chapter 2 - Vented-Box Low-Frequency Systems", "start": 61 + offset, "end": 84 + offset},
    {"name": "Chapter 3 - Passive-Radiator Low-Frequency Systems", "start": 85 + offset, "end": 94 + offset},
    {"name": "Chapter 4 - Transmission Line Low-Frequency Systems", "start": 95 + offset, "end": 103 + offset},
    {"name": "Chapter 5 - Cabinet Construction", "start": 105 + offset, "end": 115 + offset},
    {"name": "Chapter 6 - Loudspeaker Baffles", "start": 117 + offset, "end": 143 + offset},
    {"name": "Chapter 7 - Crossover Networks", "start": 145 + offset, "end": 193 + offset},
    {"name": "Chapter 8 - Loudspeaker Testing", "start": 195 + offset, "end": 211 + offset},
    {"name": "Chapter 9 - CAD Software", "start": 213 + offset, "end": 225 + offset},
    {"name": "Chapter 10 - Home Theater Loudspeakers", "start": 227 + offset, "end": 237 + offset},
    {"name": "Chapter 11 - Car Audio Loudspeakers", "start": 239 + offset, "end": 248 + offset},
    {"name": "Chapter 12 - Two System Designs", "start": 249 + offset, "end": 274 + offset},
]

doc = fitz.open(pdf_path)

for ch in chapters:
    filename = ch["name"].lower().replace(" - ", "_").replace(" ", "_") + ".md"
    filepath = os.path.join(output_dir, filename)
    
    print(f"Processing {ch['name']}...")
    
    with open(filepath, "w", encoding="utf-8") as md_file:
        md_file.write(f"# {ch['name']}\n\n")
        
        for page_num in range(ch["start"], ch["end"] + 1):
            if page_num >= len(doc):
                break
                
            page = doc.load_page(page_num)
            # We don't extract text here because it's a scan and we'll use subagent for OCR
            
            md_file.write(f"## Page {page_num - offset}\n\n") 
            md_file.write(f"[TRANSCRIPTION PENDING]\n\n")
            
            # Extract images
            # In a scanned PDF, the whole page is usually one or more images.
            # We also want to save the "page image" as a reference for OCR.
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # Higher res for OCR
            page_img_filename = f"page_{page_num}.png"
            pix.save(os.path.join(image_dir, page_img_filename))
            
            md_file.write(f"![Page {page_num - offset}](images/{page_img_filename})\n\n")
            
            # Also extract embedded images if any (sometimes there are both)
            images = page.get_images(full=True)
            for img_index, img in enumerate(images):
                xref = img[0]
                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    img_filename = f"p{page_num}_img{img_index}.{image_ext}"
                    img_path = os.path.join(image_dir, img_filename)
                    
                    with open(img_path, "wb") as f:
                        f.write(image_bytes)
                    
                    md_file.write(f"![Embedded Image {img_index}](images/{img_filename})\n\n")
                except:
                    pass

print("Done.")
