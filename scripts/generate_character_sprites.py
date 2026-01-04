#!/usr/bin/env python3
"""
Generate character sprite PNG files from the game.js fillRect coordinates
"""

from PIL import Image, ImageDraw

# Color definitions from game.js
colors = {
    'skin': (255, 176, 138),
    'hair': (58, 31, 15),
    'shirt': (76, 125, 255),
    'pants': (43, 47, 79),
    'eyes': (0, 0, 0),
    'shoes': (34, 34, 34),
    'blood': (204, 0, 0),
}

# Scale factor (s = 2 in the code)
s = 2
w = 16 * s  # 32 pixels
h = 24 * s  # 48 pixels


def create_frame(pose):
    """Create a single character frame based on pose"""
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if pose == 'duck':
        yOff = 16 * s  # Push graphics to bottom

        # Skin (head)
        draw.rectangle([10*s, 0*s + yOff, 10*s + 4*s - 1, 0*s + yOff + 4*s - 1], fill=colors['skin'])
        # Hair
        draw.rectangle([12*s, 0*s + yOff, 12*s + 2*s - 1, 0*s + yOff + 2*s - 1], fill=colors['hair'])
        # Shirt
        draw.rectangle([4*s, 2*s + yOff, 4*s + 8*s - 1, 2*s + yOff + 4*s - 1], fill=colors['shirt'])
        # Pants
        draw.rectangle([0*s, 4*s + yOff, 0*s + 6*s - 1, 4*s + yOff + 4*s - 1], fill=colors['pants'])

    elif pose == 'dead':
        # Shirt
        draw.rectangle([4*s, 7*s, 4*s + 8*s - 1, 7*s + 7*s - 1], fill=colors['shirt'])
        # Pants
        draw.rectangle([4*s, 14*s, 4*s + 8*s - 1, 14*s + 4*s - 1], fill=colors['pants'])
        # Legs (collapsed)
        draw.rectangle([2*s, 18*s, 2*s + 4*s - 1, 18*s + 2*s - 1], fill=colors['pants'])
        draw.rectangle([10*s, 18*s, 10*s + 4*s - 1, 18*s + 2*s - 1], fill=colors['pants'])
        # Feet
        draw.rectangle([0*s, 20*s, 0*s + 2*s - 1, 20*s + 2*s - 1], fill=colors['shoes'])
        draw.rectangle([14*s, 20*s, 14*s + 2*s - 1, 20*s + 2*s - 1], fill=colors['shoes'])

        # Blood spurts from neck
        draw.rectangle([6*s, 6*s, 6*s + 4*s - 1, 6*s + 1*s - 1], fill=colors['blood'])
        draw.rectangle([5*s, 5*s, 5*s + 1*s - 1, 5*s + 2*s - 1], fill=colors['blood'])
        draw.rectangle([10*s, 5*s, 10*s + 1*s - 1, 5*s + 2*s - 1], fill=colors['blood'])

    else:  # run1, run2, run3, run4, jump
        # Hair
        draw.rectangle([5*s, 0*s, 5*s + 6*s - 1, 0*s + 3*s - 1], fill=colors['hair'])
        # Skin (face)
        draw.rectangle([5*s, 2*s, 5*s + 6*s - 1, 2*s + 5*s - 1], fill=colors['skin'])
        # Eyes
        draw.rectangle([9*s, 3*s, 9*s + 2*s - 1, 3*s + 2*s - 1], fill=colors['eyes'])
        # Shirt
        draw.rectangle([4*s, 7*s, 4*s + 8*s - 1, 7*s + 7*s - 1], fill=colors['shirt'])

        # Arms (skin)
        if pose == 'jump':
            draw.rectangle([2*s, 5*s, 2*s + 2*s - 1, 5*s + 4*s - 1], fill=colors['skin'])
            draw.rectangle([12*s, 5*s, 12*s + 2*s - 1, 5*s + 4*s - 1], fill=colors['skin'])
        else:
            if pose in ['run1', 'run3']:
                draw.rectangle([2*s, 8*s, 2*s + 2*s - 1, 8*s + 4*s - 1], fill=colors['skin'])
                draw.rectangle([12*s, 10*s, 12*s + 2*s - 1, 10*s + 4*s - 1], fill=colors['skin'])
            else:  # run2, run4
                draw.rectangle([2*s, 10*s, 2*s + 2*s - 1, 10*s + 4*s - 1], fill=colors['skin'])
                draw.rectangle([12*s, 8*s, 12*s + 2*s - 1, 8*s + 4*s - 1], fill=colors['skin'])

        # Pants (upper)
        draw.rectangle([4*s, 14*s, 4*s + 8*s - 1, 14*s + 4*s - 1], fill=colors['pants'])

        # Legs (pants lower)
        if pose == 'jump':
            draw.rectangle([4*s, 18*s, 4*s + 3*s - 1, 18*s + 4*s - 1], fill=colors['pants'])
            draw.rectangle([9*s, 18*s, 9*s + 3*s - 1, 18*s + 4*s - 1], fill=colors['pants'])
        elif pose == 'run1':
            draw.rectangle([3*s, 18*s, 3*s + 3*s - 1, 18*s + 6*s - 1], fill=colors['pants'])
            draw.rectangle([10*s, 18*s, 10*s + 3*s - 1, 18*s + 4*s - 1], fill=colors['pants'])
        elif pose == 'run2':
            draw.rectangle([5*s, 18*s, 5*s + 3*s - 1, 18*s + 5*s - 1], fill=colors['pants'])
            draw.rectangle([8*s, 18*s, 8*s + 3*s - 1, 18*s + 5*s - 1], fill=colors['pants'])
        elif pose == 'run3':
            draw.rectangle([10*s, 18*s, 10*s + 3*s - 1, 18*s + 6*s - 1], fill=colors['pants'])
            draw.rectangle([3*s, 18*s, 3*s + 3*s - 1, 18*s + 4*s - 1], fill=colors['pants'])
        elif pose == 'run4':
            draw.rectangle([5*s, 18*s, 5*s + 3*s - 1, 18*s + 5*s - 1], fill=colors['pants'])
            draw.rectangle([8*s, 18*s, 8*s + 3*s - 1, 18*s + 5*s - 1], fill=colors['pants'])

        # Shoes
        if pose != 'jump':
            if pose == 'run1':
                draw.rectangle([2*s, 22*s, 2*s + 4*s - 1, 22*s + 2*s - 1], fill=colors['shoes'])
                draw.rectangle([10*s, 20*s, 10*s + 4*s - 1, 20*s + 2*s - 1], fill=colors['shoes'])
            elif pose == 'run3':
                draw.rectangle([10*s, 22*s, 10*s + 4*s - 1, 22*s + 2*s - 1], fill=colors['shoes'])
                draw.rectangle([2*s, 20*s, 2*s + 4*s - 1, 20*s + 2*s - 1], fill=colors['shoes'])
            else:  # run2, run4
                draw.rectangle([4*s, 21*s, 4*s + 4*s - 1, 21*s + 2*s - 1], fill=colors['shoes'])
                draw.rectangle([8*s, 21*s, 8*s + 4*s - 1, 21*s + 2*s - 1], fill=colors['shoes'])

    return img


def main():
    """Generate all 7 character frames"""
    frames = ['run1', 'run2', 'run3', 'run4', 'jump', 'duck', 'dead']

    for frame in frames:
        img = create_frame(frame)
        filename = f'player_{frame}.png'
        img.save(filename)
        print(f'Created {filename}')

    print('\nAll character sprites generated successfully!')


if __name__ == '__main__':
    main()
