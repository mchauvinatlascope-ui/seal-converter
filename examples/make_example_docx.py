"""Writes example-protocol.docx, a made-up protocol used to try the Word import.

Run: python3 examples/make_example_docx.py   (standard library only)
"""
import os
import struct
import zipfile
import zlib
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def run(text, b=False, i=False, sup=False):
    props = ''.join([
        '<w:b/>' if b else '',
        '<w:i/>' if i else '',
        '<w:vertAlign w:val="superscript"/>' if sup else '',
    ])
    rpr = f'<w:rPr>{props}</w:rPr>' if props else ''
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def para(*runs, style=None, numbered=False):
    ppr = ''
    if style or numbered:
        ppr = '<w:pPr>'
        if style:
            ppr += f'<w:pStyle w:val="{style}"/>'
        if numbered:
            ppr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
        ppr += '</w:pPr>'
    body = ''.join(r if r.startswith('<w:r>') else run(r) for r in runs)
    return f'<w:p>{ppr}{body}</w:p>'


def small_png(width=96, height=64):
    """A plain blue square, so the example file carries a picture."""
    def chunk(kind, data):
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))

    raw = b''
    for y in range(height):
        raw += b'\x00' + bytes([45, 114, 210] * width)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw))
            + chunk(b'IEND', b''))


def picture(name='photo.png', size_cm=3):
    emu = int(size_cm * 360000)
    return (
        '<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">'
        f'<wp:extent cx="{emu}" cy="{int(emu * 2 / 3)}"/><wp:docPr id="1" name="{name}"/>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        f'<pic:nvPicPr><pic:cNvPr id="1" name="{name}"/><pic:cNvPicPr/></pic:nvPicPr>'
        '<pic:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{emu}" cy="{int(emu * 2 / 3)}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
    )


def table(rows):
    out = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr>'
    for row in rows:
        out += '<w:tr>' + ''.join(f'<w:tc>{para(c) if isinstance(c, str) else para(*c)}</w:tc>' for c in row) + '</w:tr>'
    return out + '</w:tbl>'


body = ''.join([
    para('Example: OVA immunisation and spleen staining', style='Title'),
    para('Made-up protocol for trying seal-converter. Not a real lab procedure.'),
    para('Before experiments', style='Heading1'),
    para('Buffers', style='Heading2'),
    table([
        [[run('Buffer', b=True)], [run('Composition', b=True)]],
        ['FACS buffer', 'PBS + 2 % FBS + 2 mM EDTA'],
        ['Red cell lysis', 'ACK, 1 mL per spleen'],
    ]),
    para('Antigen preparation', style='Heading2'),
    para(run('Dilute '), run('OVA', b=True), run(' to 1 mg/mL in sterile PBS.'), numbered=True),
    para(run('Mix 1:1 with '), run('alum', b=True), run(' for 30 min at RT '), run('(vortex every 10 min)', i=True), run('.'), numbered=True),
    para(run('Keep on ice — use within 2 h.'), numbered=True),
    para('Day 0', style='Heading1'),
    para('Immunisation', style='Heading2'),
    para(run('1. Inject 50 µL subcutaneously in each hock, 2 times, 10 min apart.')),
    para(run('2. Check the mice after 1 h.')),
    para('Day 7', style='Heading1'),
    para('Spleen staining', style='Heading2'),
    para(run('Plate 2 × 10'), run('6', sup=True), run(' cells per well.'), numbered=True),
    para(run('Stain with anti-CD45 BV421 at 1:200 for 20 min at 4 °C.'), numbered=True),
    para(run('Spin at 400 x g for 5 min and wash twice with 200 µL '), run('FACS buffer', b=True), run('.'), numbered=True),
    para('Gating strategy used on the day:'),
    picture(),
])

NS = (W + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
      ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"')
document = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {NS}><w:body>{body}</w:body></w:document>'

styles = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles {W}>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>
</w:styles>'''

numbering = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering {W}>
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>'''

content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>'''

rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/photo.png"/>
</Relationships>'''

out = os.path.join(HERE, 'example-protocol.docx')
with zipfile.ZipFile(out + '.tmp', 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', content_types)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/_rels/document.xml.rels', doc_rels)
    z.writestr('word/document.xml', document)
    z.writestr('word/styles.xml', styles)
    z.writestr('word/numbering.xml', numbering)
    z.writestr('word/media/photo.png', small_png())
os.replace(out + '.tmp', out)
print('wrote', out)
