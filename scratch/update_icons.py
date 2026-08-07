import os
import sys
import shutil
from PIL import Image, ImageOps

def make_transparent_logo(src_path):
    print(f"Loading original logo: {src_path}")
    img = Image.open(src_path).convert("RGBA")
    
    # Get background color sample from top-left pixel (0, 0)
    bg_color = img.getpixel((0, 0))
    print(f"Detected background color sample: {bg_color}")
    
    # We want to make pixels close to the background color transparent.
    # Since the background is dark, we do NOT want to erase white/bright pixels.
    datas = img.getdata()
    newData = []
    
    # Distance threshold in RGB space (lower = stricter match to bg_color)
    threshold = 40
    
    for item in datas:
        r_diff = item[0] - bg_color[0]
        g_diff = item[1] - bg_color[1]
        b_diff = item[2] - bg_color[2]
        dist = (r_diff**2 + g_diff**2 + b_diff**2)**0.5
        
        if dist < threshold:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    return img

def create_adaptive_foreground(transparent_img, size):
    # Adaptive foreground canvas is 108dp. Logo should occupy 60% of the canvas.
    fg_canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    logo_size = int(size * 0.65)
    resized_logo = transparent_img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    
    # Paste centered
    offset = (size - logo_size) // 2
    fg_canvas.paste(resized_logo, (offset, offset), resized_logo)
    return fg_canvas

def main():
    src_logo = "C:/Users/HP/.gemini/antigravity/brain/13b1a460-6a9a-4ea8-8691-781ddaa3c45b/microscope_logo_1785441920040.jpg"
    if not os.path.exists(src_logo):
        print(f"Error: Original logo file not found at {src_logo}")
        return
        
    transparent_img = make_transparent_logo(src_logo)
    
    # Save web assets
    print("Saving web app logo assets...")
    transparent_img.resize((512, 512), Image.Resampling.LANCZOS).save("public/logo.png", "PNG")
    transparent_img.resize((192, 192), Image.Resampling.LANCZOS).save("public/icon-192.png", "PNG")
    transparent_img.resize((512, 512), Image.Resampling.LANCZOS).save("public/icon-512.png", "PNG")
    transparent_img.resize((512, 512), Image.Resampling.LANCZOS).save("public/splash.png", "PNG")
    
    # Android mipmap densities and dimensions
    android_res_dir = "android/app/src/main/res"
    densities = {
        "mipmap-mdpi": {"launcher": 48, "foreground": 108},
        "mipmap-hdpi": {"launcher": 72, "foreground": 162},
        "mipmap-xhdpi": {"launcher": 96, "foreground": 216},
        "mipmap-xxhdpi": {"launcher": 144, "foreground": 324},
        "mipmap-xxxhdpi": {"launcher": 192, "foreground": 432}
    }
    
    for folder, sizes in densities.items():
        folder_path = os.path.join(android_res_dir, folder)
        if not os.path.exists(folder_path):
            print(f"Skipping directory (not found): {folder_path}")
            continue
            
        print(f"Generating launcher assets in {folder}...")
        
        # 1. ic_launcher.png (standard square/shaped launcher icon)
        launcher_size = sizes["launcher"]
        resized_launcher = transparent_img.resize((launcher_size, launcher_size), Image.Resampling.LANCZOS)
        resized_launcher.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
        
        # 2. ic_launcher_round.png
        resized_launcher.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
        
        # 3. ic_launcher_foreground.png (adaptive foreground)
        fg_size = sizes["foreground"]
        fg_img = create_adaptive_foreground(transparent_img, fg_size)
        fg_img.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
        
    print("Launcher assets generation completed successfully!")

if __name__ == "__main__":
    main()
