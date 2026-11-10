import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export function createMockEpubDirectory(targetDir: string): string {
  const epubDir = path.join(targetDir, 'mock_book.epub');
  const metaInf = path.join(epubDir, 'META-INF');
  const oebps = path.join(epubDir, 'OEBPS');

  fs.mkdirSync(metaInf, { recursive: true });
  fs.mkdirSync(oebps, { recursive: true });

  // 1. container.xml
  fs.writeFileSync(
    path.join(metaInf, 'container.xml'),
    `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`
  );

  // 2. content.opf
  fs.writeFileSync(
    path.join(oebps, 'cover.jpg'),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
  );

  fs.writeFileSync(
    path.join(oebps, 'content.opf'),
    `<?xml version="1.0" encoding="utf-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>模拟测试书籍</dc:title>
      </metadata>
      <manifest>
        <item id="cover-image" href="cover.jpg" properties="cover-image" media-type="image/jpeg"/>
        <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="chapter1" href="ch01.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine>
        <itemref idref="chapter1"/>
      </spine>
    </package>`
  );

  // 3. toc.xhtml
  fs.writeFileSync(
    path.join(oebps, 'toc.xhtml'),
    `<?xml version="1.0" encoding="utf-8"?>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
      <body>
        <nav epub:type="toc">
          <ol>
            <li><a href="ch01.xhtml">第一章：直觉与理性</a></li>
          </ol>
        </nav>
      </body>
    </html>`
  );

  // 4. ch01.xhtml (带有多个自然段)
  fs.writeFileSync(
    path.join(oebps, 'ch01.xhtml'),
    `<?xml version="1.0" encoding="utf-8"?>
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head><title>第一章</title></head>
      <body>
        <h1>第一章：直觉与理性</h1>
        <p>这是前置导读段落，阐述人类大脑的双系统决策架构背景。</p>
        <p>心理学研究表明，直觉在日常判断中占据主导，但也会产生偏见。</p>
        <p>系统1的运行是无意识且快速的，不怎么费脑力，没有感觉，完全处于自主控制状态。</p>
        <p>相比之下，系统2则需要调动注意力进行深度的数理逻辑运算与权衡。</p>
        <p>结论是，优秀的决策者必须学会察觉系统1的偏见并适时激活系统2。</p>
      </body>
    </html>`
  );

  return epubDir;
}

export function createMockEpubZip(targetDir: string): string {
  const dirPath = createMockEpubDirectory(targetDir);
  const zipPath = path.join(targetDir, 'mock_book_zipped.epub');
  const zip = new AdmZip();
  zip.addLocalFolder(dirPath);
  zip.writeZip(zipPath);
  return zipPath;
}

export function createMockEpub2WithNcx(targetDir: string): string {
  const epubDir = path.join(targetDir, 'mock_epub2_ncx.epub');
  const metaInf = path.join(epubDir, 'META-INF');
  const oebps = path.join(epubDir, 'OEBPS');

  fs.mkdirSync(metaInf, { recursive: true });
  fs.mkdirSync(oebps, { recursive: true });

  // 1. container.xml
  fs.writeFileSync(
    path.join(metaInf, 'container.xml'),
    `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`
  );

  // 2. content.opf
  fs.writeFileSync(
    path.join(oebps, 'cover.jpg'),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
  );

  fs.writeFileSync(
    path.join(oebps, 'content.opf'),
    `<?xml version="1.0" encoding="utf-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="pub-id">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>EPUB2 NCX 模拟书籍</dc:title>
      </metadata>
      <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="chap1" href="ch01.html" media-type="application/xhtml+xml"/>
        <item id="chap2" href="ch02.html" media-type="application/xhtml+xml"/>
      </manifest>
      <spine toc="ncx">
        <itemref idref="chap1"/>
        <itemref idref="chap2"/>
      </spine>
    </package>`
  );

  // 3. toc.ncx with multiple navPoints
  fs.writeFileSync(
    path.join(oebps, 'toc.ncx'),
    `<?xml version="1.0" encoding="utf-8"?>
    <!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
    <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
      <navMap>
        <navPoint id="np-1" playOrder="1">
          <navLabel>
            <text>第一章：直觉与理性</text>
          </navLabel>
          <content src="ch01.html"/>
        </navPoint>
        <navPoint id="np-2" playOrder="2">
          <navLabel>
            <text>第二章：启发与偏见</text>
          </navLabel>
          <content src="ch02.html"/>
        </navPoint>
      </navMap>
    </ncx>`
  );

  // 4. ch01.html & ch02.html
  fs.writeFileSync(
    path.join(oebps, 'ch01.html'),
    `<html><body><p>第一章内容。</p></body></html>`
  );
  fs.writeFileSync(
    path.join(oebps, 'ch02.html'),
    `<html><body><p>第二章内容，涉及代表性启发与锚定效应。</p></body></html>`
  );

  return epubDir;
}
