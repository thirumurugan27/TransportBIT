package utils

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"time"
	"github.com/gin-gonic/gin"
	"github.com/go-pdf/fpdf"
)

// ─────────────────────────────────────────────────────────────────────────────
//  BIT Transport Management System – PDF Report Engine
// ─────────────────────────────────────────────────────────────────────────────

// PDFReport wraps fpdf for consistent, institution-branded report generation.
type PDFReport struct {
	Pdf       *fpdf.Fpdf
	Title     string
	Subtitle  string
	PageWidth float64
	PageH     float64
	Margin    float64
	Usable    float64
}

// ── Colour palette ───────────────────────────────────────────────────────────
const (
	clrNavyR, clrNavyG, clrNavyB       = 13, 37, 80
	clrGoldR, clrGoldG, clrGoldB       = 180, 140, 30
	clrTblHR, clrTblHG, clrTblHB       = 13, 37, 80
	clrAlt1R, clrAlt1G, clrAlt1B       = 240, 244, 252
	clrAlt2R, clrAlt2G, clrAlt2B       = 255, 255, 255
	clrTotR, clrTotG, clrTotB          = 210, 222, 245
	clrBodyR, clrBodyG, clrBodyB       = 20, 20, 40
	clrMutedR, clrMutedG, clrMutedB   = 110, 110, 130
	clrSecR, clrSecG, clrSecB          = 30, 60, 130
	clrBorderR, clrBorderG, clrBorderB = 185, 200, 225
)

// ── Cell rendering constants ─────────────────────────────────────────────────
const (
	lineH    = 4.5 // text line height in mm
	cellPadX = 1.5 // horizontal inner padding per side
	cellPadY = 1.2 // vertical inner padding per side (top & bottom)
)

const logoPath = "assets/logo.png"

// ─────────────────────────────────────────────────────────────────────────────
//  Constructor
// ─────────────────────────────────────────────────────────────────────────────

func NewPDFReport(title, subtitle string, landscape bool) *PDFReport {
	orient := "P"
	if landscape {
		orient = "L"
	}
	pdf := fpdf.New(orient, "mm", "A4", "")
	pdf.SetAutoPageBreak(false, 0) // manual page breaks so rows never split mid-cell

	pageW, pageH := pdf.GetPageSize()
	margin := 10.0
	pdf.SetMargins(margin, 43, margin)

	pr := &PDFReport{
		Pdf:       pdf,
		Title:     title,
		Subtitle:  subtitle,
		PageWidth: pageW,
		PageH:     pageH,
		Margin:    margin,
		Usable:    pageW - 2*margin,
	}

	// ── Header ───────────────────────────────────────────────────────────────
	pdf.SetHeaderFunc(func() {
		usable := pageW - 2*margin
		logoW, logoH, logoX, logoY := 18.0, 18.0, margin+1, 5.0

		if _, err := os.Stat(logoPath); err == nil {
			pdf.Image(logoPath, logoX, logoY, logoW, logoH, false, "", 0, "")
		}

		textX := margin + logoW + 4
		textW := usable - logoW - 5

		pdf.SetXY(textX, logoY)
		pdf.SetFont("Arial", "B", 14)
		pdf.SetTextColor(clrNavyR, clrNavyG, clrNavyB)
		pdf.CellFormat(textW, 7, "BANNARI AMMAN INSTITUTE OF TECHNOLOGY", "", 1, "C", false, 0, "")

		pdf.SetX(textX)
		pdf.SetFont("Arial", "B", 8)
		pdf.SetTextColor(clrNavyR, clrNavyG, clrNavyB)
		pdf.CellFormat(textW, 4.5, "TRANSPORT MANAGEMENT SYSTEM", "", 1, "C", false, 0, "")

		pdf.SetX(textX)
		pdf.SetFont("Arial", "", 7)
		pdf.SetTextColor(clrMutedR, clrMutedG, clrMutedB)
		pdf.CellFormat(textW, 4, "Sathyamangalam, Erode District - 638401, Tamil Nadu  |  Stay Ahead", "", 1, "C", false, 0, "")

		ruleY := logoY + logoH + 1.5
		pdf.SetDrawColor(clrNavyR, clrNavyG, clrNavyB)
		pdf.SetLineWidth(0.6)
		pdf.Line(margin, ruleY, pageW-margin, ruleY)
		pdf.SetDrawColor(clrGoldR, clrGoldG, clrGoldB)
		pdf.SetLineWidth(0.3)
		pdf.Line(margin, ruleY+1.2, pageW-margin, ruleY+1.2)

		pdf.SetXY(margin, ruleY+3.5)
		pdf.SetFont("Arial", "B", 11)
		pdf.SetTextColor(clrNavyR, clrNavyG, clrNavyB)
		pdf.CellFormat(usable, 6.5, pr.Title, "", 1, "C", false, 0, "")

		if pr.Subtitle != "" {
			pdf.SetFont("Arial", "", 7)
			pdf.SetTextColor(clrMutedR, clrMutedG, clrMutedB)
			pdf.CellFormat(usable, 4, pr.Subtitle, "", 1, "C", false, 0, "")
		}

		sepY := pdf.GetY() + 0.5
		pdf.SetDrawColor(clrNavyR, clrNavyG, clrNavyB)
		pdf.SetLineWidth(0.2)
		pdf.Line(margin, sepY, pageW-margin, sepY)
		pdf.Ln(2)
	})

	// ── Footer ───────────────────────────────────────────────────────────────
	pdf.SetFooterFunc(func() {
		pdf.SetY(pageH - 12)
		pdf.SetDrawColor(clrNavyR, clrNavyG, clrNavyB)
		pdf.SetLineWidth(0.2)
		pdf.Line(margin, pdf.GetY(), pageW-margin, pdf.GetY())
		pdf.Ln(1)
		pdf.SetFont("Arial", "I", 6.5)
		pdf.SetTextColor(clrMutedR, clrMutedG, clrMutedB)
		w2 := (pageW - 2*margin) / 2
		pdf.CellFormat(w2, 5, "BIT Transport Management System  |  "+time.Now().Format("02 Jan 2006  03:04 PM"), "", 0, "L", false, 0, "")
		pdf.CellFormat(w2, 5, fmt.Sprintf("Page %d of {nb}", pdf.PageNo()), "", 0, "R", false, 0, "")
	})

	pdf.AliasNbPages("")
	pdf.AddPage()
	return pr
}

// ─────────────────────────────────────────────────────────────────────────────
//  Width scaling – always fills exactly the usable width
// ─────────────────────────────────────────────────────────────────────────────

// scaleWidths proportionally scales colWidths to sum exactly to usable.
// Works for both shrink (overflow) and expand (too narrow) cases.
func scaleWidths(colWidths []float64, usable float64) []float64 {
	sum := 0.0
	for _, w := range colWidths {
		sum += w
	}
	if sum == 0 || (sum > usable-0.1 && sum < usable+0.1) {
		return colWidths
	}
	scaled := make([]float64, len(colWidths))
	allocated := 0.0
	for i, w := range colWidths {
		if i == len(colWidths)-1 {
			scaled[i] = usable - allocated
		} else {
			scaled[i] = float64(int((w/sum*usable)*10+0.5)) / 10
			allocated += scaled[i]
		}
	}
	return scaled
}

// ─────────────────────────────────────────────────────────────────────────────
//  Core multi-line table renderer
// ─────────────────────────────────────────────────────────────────────────────

// cellLines returns how many text lines a cell needs given its inner width.
// Font must be set before calling.
func cellLines(pdf *fpdf.Fpdf, text string, innerW float64) int {
	if text == "" || innerW <= 0 {
		return 1
	}
	lines := pdf.SplitLines([]byte(text), innerW)
	if len(lines) == 0 {
		return 1
	}
	return len(lines)
}

// rowHeight returns the pixel height for a row based on its tallest cell.
// Font must already be set.
func rowHeight(pdf *fpdf.Fpdf, cells []string, scaled []float64) float64 {
	max := 1
	for i, cell := range cells {
		if i >= len(scaled) {
			break
		}
		n := cellLines(pdf, cell, scaled[i]-2*cellPadX)
		if n > max {
			max = n
		}
	}
	return float64(max)*lineH + 2*cellPadY
}

// drawCells renders one row of cells at the current Y.
// Each cell auto-wraps text; background, text, and border are drawn explicitly.
func (pr *PDFReport) drawCells(cells []string, scaled []float64, rh float64,
	fillR, fillG, fillB, textR, textG, textB int, fontStyle string, firstColCenter bool) {

	pdf := pr.Pdf
	startY := pdf.GetY()
	x := pr.Margin

	pdf.SetFont("Arial", fontStyle, 7)
	pdf.SetTextColor(textR, textG, textB)

	for i, cell := range cells {
		if i >= len(scaled) {
			break
		}
		w := scaled[i]

		// background fill
		pdf.SetFillColor(fillR, fillG, fillB)
		pdf.SetDrawColor(fillR, fillG, fillB)
		pdf.Rect(x, startY, w, rh, "F")

		// text with word-wrap (no built-in border from MultiCell)
		align := "L"
		if fontStyle == "B" {
			align = "C"
		} else if i == 0 && firstColCenter {
			align = "C"
		}
		innerW := w - 2*cellPadX
		if innerW < 1 {
			innerW = 1
		}
		pdf.SetXY(x+cellPadX, startY+cellPadY)
		pdf.MultiCell(innerW, lineH, cell, "", align, false)

		// cell border
		pdf.SetDrawColor(clrBorderR, clrBorderG, clrBorderB)
		pdf.SetLineWidth(0.15)
		pdf.Rect(x, startY, w, rh, "D")

		x += w
	}
	pdf.SetY(startY + rh)
}

// bottomY is the Y limit per page (leaves room for footer).
func (pr *PDFReport) bottomY() float64 { return pr.PageH - 14 }

// AddTable renders a full-width table where every row auto-expands its height
// to fit wrapped text.  The column header is reprinted on each new page.
func (pr *PDFReport) AddTable(headers []string, rows [][]string, colWidths []float64) {
	pdf := pr.Pdf
	scaled := scaleWidths(colWidths, pr.Usable)

	drawHeader := func() {
		pdf.SetFont("Arial", "B", 7)
		hh := rowHeight(pdf, headers, scaled)
		pr.drawCells(headers, scaled, hh,
			clrTblHR, clrTblHG, clrTblHB,
			255, 255, 255, "B", false)
	}

	drawHeader()

	if len(rows) == 0 {
		pdf.SetFont("Arial", "I", 8)
		pdf.SetTextColor(clrMutedR, clrMutedG, clrMutedB)
		pdf.SetFillColor(clrAlt1R, clrAlt1G, clrAlt1B)
		pdf.CellFormat(pr.Usable, 8, "No records found for the selected period.", "1", 1, "C", true, 0, "")
		return
	}

	pdf.SetFont("Arial", "", 7)
	for ri, row := range rows {
		rh := rowHeight(pdf, row, scaled)

		// page break — redraw header on new page
		if pdf.GetY()+rh > pr.bottomY() {
			pdf.AddPage()
			drawHeader()
			pdf.SetFont("Arial", "", 7)
		}

		var fr, fg, fb int
		if ri%2 == 0 {
			fr, fg, fb = clrAlt1R, clrAlt1G, clrAlt1B
		} else {
			fr, fg, fb = clrAlt2R, clrAlt2G, clrAlt2B
		}
		pr.drawCells(row, scaled, rh,
			fr, fg, fb,
			clrBodyR, clrBodyG, clrBodyB, "", true)
	}
}

// AddTotalRow draws a highlighted totals row aligned to the same column widths.
func (pr *PDFReport) AddTotalRow(values []string, colWidths []float64) {
	pdf := pr.Pdf
	scaled := scaleWidths(colWidths, pr.Usable)
	pdf.SetFont("Arial", "B", 7)
	rh := rowHeight(pdf, values, scaled)
	pr.drawCells(values, scaled, rh,
		clrTotR, clrTotG, clrTotB,
		clrNavyR, clrNavyG, clrNavyB, "B", false)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Section heading & key-value pairs
// ─────────────────────────────────────────────────────────────────────────────

// AddSection inserts a solid navy section heading bar.
func (pr *PDFReport) AddSection(title string) {
	pdf := pr.Pdf
	pdf.Ln(4)
	pdf.SetFillColor(clrNavyR, clrNavyG, clrNavyB)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 9)
	pdf.CellFormat(pr.Usable, 6.5, "  "+title, "0", 1, "L", true, 0, "")
	pdf.Ln(1)
}

// AddKeyValue renders a label + value pair.
func (pr *PDFReport) AddKeyValue(label, value string) {
	pdf := pr.Pdf
	pdf.SetFont("Arial", "B", 8)
	pdf.SetTextColor(clrSecR, clrSecG, clrSecB)
	pdf.CellFormat(48, 5.5, label, "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.SetTextColor(clrBodyR, clrBodyG, clrBodyB)
	pdf.CellFormat(pr.Usable-48, 5.5, value, "", 1, "L", false, 0, "")
}

// ─────────────────────────────────────────────────────────────────────────────
//  HTTP response
// ─────────────────────────────────────────────────────────────────────────────

// Send writes the finished PDF to the HTTP response as an attachment.
func (pr *PDFReport) Send(c *gin.Context, filename string) {
	if err := pr.Pdf.Error(); err != nil {
		log.Printf("PDF generation error: %v", err)
		c.JSON(500, gin.H{"error": "Failed to generate PDF"})
		return
	}
	var buf bytes.Buffer
	if err := pr.Pdf.Output(&buf); err != nil {
		log.Printf("PDF output error: %v", err)
		c.JSON(500, gin.H{"error": "Failed to generate PDF"})
		return
	}
	log.Printf("PDF generated: %d bytes  →  %s", buf.Len(), filename)
	c.Writer.Header().Set("Content-Type", "application/pdf")
	c.Writer.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", buf.Len()))
	c.Writer.WriteHeader(200)
	c.Writer.Write(buf.Bytes())
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

// FmtMoney formats a float64 as "Rs.12,345".
func FmtMoney(v float64) string {
	if v == 0 {
		return "Rs.0"
	}
	return fmt.Sprintf("Rs.%.0f", v)
}
