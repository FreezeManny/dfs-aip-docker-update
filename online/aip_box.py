#!/bin/env python3

#
# Copyright (C) 2021 Mario Haustein, mario@mariohaustein.de
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public
# License as published by the Free Software Foundation; either
# version 3 of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with this program; if not, write to the Free Software Foundation,
# Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#

import argparse
import pikepdf



parser = argparse.ArgumentParser(
        description = "Boxen jeder PDF-Seite anzeigen"
    )

parser.add_argument(
    'pdfs',
    metavar = 'PDF',
    type = str,
    nargs = '+',
    help = 'PDF-Dateien')

args = parser.parse_args()



print("  # \tMedia\tCrop\tTrim\tRotation")
print()

for filename in args.pdfs:
    pdf = pikepdf.Pdf.open(filename)

    print(filename)

    for p in pdf.pages:
        page = pikepdf.Page(p)

        mediabox = [ round((float(x) / 72.0 * 25.4)) for x in page.mediabox ]
        cropbox  = [ round((float(x) / 72.0 * 25.4)) for x in page.cropbox  ]
        trimbox  = [ round((float(x) / 72.0 * 25.4)) for x in page.trimbox  ]

        boxes = []

        for box in [ mediabox, cropbox, trimbox ]:
            box_left   = min(box[0], box[2])
            box_right  = max(box[0], box[2])
            box_bottom = min(box[1], box[3])
            box_top    = max(box[1], box[3])
            box_width  = box_right - box_left
            box_height = box_top   - box_bottom

            orient = "p" if box_height > box_width else "l"

            if ( box_width, box_height ) in [ ( 148, 210 ), ( 210, 148 ) ]:
                paper = "A5"
            elif ( box_width, box_height ) in [ ( 210, 277 ), ( 277, 210 ) ]:
                paper = "A4n"
            elif ( box_width, box_height ) in [ ( 210, 297 ), ( 297, 210 ) ]:
                paper = "A4"
            elif ( box_width, box_height ) in [ ( 297, 420 ), ( 420, 297 ) ]:
                paper = "A3"
            elif ( box_width, box_height ) in [ ( 841, 1189 ), ( 1189, 841 ) ]:
                paper = "A0"
            elif ( box_width, box_height ) in [ ( 380, 297 ), ( 297, 380 ) ]:
                paper = "TC"
            else:
                paper = "%dx%d" % ( box_width, box_height )
                orient = None

            if orient is None:
                boxes.append(paper)
            else:
                boxes.append("%-3s %s" % ( paper, orient ))

        print("%3s:\t%s\t%3s" % ( page.label, "\t".join(boxes), p.get('/Rotate', "0") ))

    print()
