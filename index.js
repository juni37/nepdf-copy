const fs = require('fs')
const { join } = require('path')
const axios = require('axios')
const PDFDocument = require('pdfkit')
const { app, Menu, BrowserWindow, ipcMain, shell, dialog } = require('electron')
Menu.setApplicationMenu(null)

axios.interceptors.response.use(null, e =>
    axios(e.config))

app.whenReady().then(() => {
    const win = new BrowserWindow({
        webPreferences: {
            preload: join(__dirname, 'src', 'preload.js')
        }
    })
    win.loadFile('src/index.html')

    ipcMain.on('AuthorPortfolio', () => shell.openExternal('https://sh9351.me'))
    ipcMain.handle('ConvertPDF', (e, EbookURL) => {
        const bookCode = new URL(EbookURL).searchParams.get('bookCode')
        axios(`https://ebook.nebooks.co.kr/nw${bookCode}project.json`).then(async ({ data }) => {
            const path = dialog.showSaveDialogSync({
                defaultPath: `${process.env.USERPROFILE}\\Desktop\\${data.title}.pdf`
            })
            if (!path) return
            const doc = new PDFDocument({ size: [2383.94, 3370.39] })
            const stream = doc.pipe(fs.createWriteStream(path))

            doc.font(join(__dirname, 'src', 'Pretendard.otf')).fontSize(100)
                .text('Textbook translated through PDF via NEPDF', {
                    top: 100,
                    left: 100
                })

            let i = 0
            for (const { background } of data.pages) {
                await axios(background.url.replace('{ASSETS_DIR}', `https://ebook.nebooks.co.kr/nw${bookCode}assets/`), {
                    responseType: 'arraybuffer'
                }).then(({ data: Page }) => {
                    i++
                    doc.addPage({ size: [2383.94, 3370.39] }).image(Page, 0, 0, { width: 2383.94, height: 3370.39 })
                    win.webContents.send('Progress', `${i}/${data.pages.length}`)
                })
            }
            doc.save()
            doc.end()
            stream.on('finish', () => {
                win.webContents.send('Complete', `${i}/${data.pages.length}`)
                shell.openPath(path)
            })
        })
    })
})