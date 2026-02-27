package utils

import (
	"bytes"
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/go-pdf/fpdf"
)

// PDFReport wraps fpdf for consistent report generation with institution branding
type PDFReport struct {
	Pdf       *fpdf.Fpdf
	Title     string
	Subtitle  string
	PageWidth float64
	Margin    float64
	Usable    float64
}

// NewPDFReport creates a branded PDF report with header, footer, and page setup
func NewPDFReport(title, subtitle string, landscape bool) *PDFReport {
	orient := "P"
	if landscape {
		orient = "L"
	}
	pdf := fpdf.New(orient, "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 15)

	pageW, _ := pdf.GetPageSize()
	margin := 10.0
	pdf.SetMargins(margin, 35, margin) // top margin 35 to leave room for header

	pr := &PDFReport{
		Pdf:       pdf,
		Title:     title,
		Subtitle:  subtitle,
		PageWidth: pageW,
		Margin:    margin,
		Usable:    pageW - 2*margin,
	}

	pdf.SetHeaderFunc(func() {
		pdf.SetY(5)
		// Logo (if exists)
		logoPath := "assets/logo.png"
		if _, err := os.Stat(logoPath); err == nil {
			pdf.Image(logoPath, margin+2, 5, 16, 0, false, "", 0, "")
		}

		// Institution name
		pdf.SetFont("Arial", "B", 13)
		pdf.SetTextColor(25, 25, 70)
		pdf.CellFormat(pr.Usable, 7, "BANNARI AMMAN INSTITUTE OF TECHNOLOGY", "", 1, "C", false, 0, "")
		pdf.SetFont("Arial", "", 8)
		pdf.SetTextColor(100, 100, 100)
		pdf.CellFormat(pr.Usable, 4, "Sathyamangalam, Erode District - 638401, Tamil Nadu", "", 1, "C", false, 0, "")
		pdf.Ln(1)

		// Divider
		pdf.SetDrawColor(125, 83, 246)
		pdf.SetLineWidth(0.5)
		y := pdf.GetY()
		pdf.Line(margin, y, pageW-margin, y)
		pdf.Ln(2)

		// Report title
		pdf.SetFont("Arial", "B", 11)
		pdf.SetTextColor(125, 83, 246)
		pdf.CellFormat(pr.Usable, 6, pr.Title, "", 1, "C", false, 0, "")
		if pr.Subtitle != "" {
			pdf.SetFont("Arial", "", 7)
			pdf.SetTextColor(100, 100, 100)
			pdf.CellFormat(pr.Usable, 4, pr.Subtitle, "", 1, "C", false, 0, "")
		}
		pdf.Ln(2)
	})

	pdf.SetFooterFunc(func() {
		pdf.SetY(-12)
		pdf.SetFont("Arial", "I", 7)
		pdf.SetTextColor(140, 140, 140)
		pdf.CellFormat(0, 10, fmt.Sprintf("Page %d/{nb}", pdf.PageNo()), "", 0, "C", false, 0, "")
	})

	pdf.AliasNbPages("")
	pdf.AddPage()
	return pr
}

// AddTable renders a table with headers and data rows
func (pr *PDFReport) AddTable(headers []string, rows [][]string, colWidths []float64) {
	pdf := pr.Pdf

	// Header row
	pdf.SetFont("Arial", "B", 7)
	pdf.SetFillColor(125, 83, 246)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetDrawColor(125, 83, 246)
	for i, h := range headers {
		pdf.CellFormat(colWidths[i], 6, h, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	// Data rows
	pdf.SetFont("Arial", "", 7)
	pdf.SetDrawColor(210, 210, 210)
	for ri, row := range rows {
		if ri%2 == 0 {
			pdf.SetFillColor(248, 248, 252)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}
		pdf.SetTextColor(30, 30, 30)
		for i := 0; i < len(headers) && i < len(row); i++ {
			align := "L"
			if i == 0 {
				align = "C"
			}
			pdf.CellFormat(colWidths[i], 5.5, pdfTrunc(row[i], colWidths[i]), "1", 0, align, true, 0, "")
		}
		pdf.Ln(-1)
	}
}

// AddTotalRow adds a bold totals row at the bottom of a table
func (pr *PDFReport) AddTotalRow(values []string, colWidths []float64) {
	pdf := pr.Pdf
	pdf.SetFont("Arial", "B", 7)
	pdf.SetFillColor(235, 235, 245)
	pdf.SetTextColor(30, 30, 30)
	pdf.SetDrawColor(125, 83, 246)
	for i, v := range values {
		pdf.CellFormat(colWidths[i], 6, v, "1", 0, "R", true, 0, "")
	}
	pdf.Ln(-1)
}

// AddSection adds a section title
func (pr *PDFReport) AddSection(title string) {
	pdf := pr.Pdf
	pdf.Ln(4)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetTextColor(125, 83, 246)
	pdf.SetDrawColor(125, 83, 246)
	pdf.CellFormat(pr.Usable, 7, title, "B", 1, "L", false, 0, "")
	pdf.Ln(2)
}

// AddKeyValue renders a label: value pair
func (pr *PDFReport) AddKeyValue(label, value string) {
	pdf := pr.Pdf
	pdf.SetFont("Arial", "B", 8)
	pdf.SetTextColor(80, 80, 80)
	pdf.CellFormat(45, 5.5, label, "", 0, "L", false, 0, "")
	pdf.SetFont("Arial", "", 8)
	pdf.SetTextColor(30, 30, 30)
	pdf.CellFormat(pr.Usable-45, 5.5, value, "", 1, "L", false, 0, "")
}

// Send outputs the PDF to the HTTP response
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

	log.Printf("PDF generated successfully: %d bytes for %s", buf.Len(), filename)

	c.Writer.Header().Set("Content-Type", "application/pdf")
	c.Writer.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Writer.Header().Set("Content-Length", fmt.Sprintf("%d", buf.Len()))
	c.Writer.WriteHeader(200)
	c.Writer.Write(buf.Bytes())
}

// pdfTrunc truncates text to fit column width
func pdfTrunc(s string, w float64) string {
	maxChars := int(w / 1.8)
	if maxChars < 4 {
		maxChars = 4
	}
	if len(s) > maxChars {
		return s[:maxChars-2] + ".."
	}
	return s
}

// FmtMoney formats a float as Rs.XX,XXX
func FmtMoney(v float64) string {
	if v == 0 {
		return "Rs.0"
	}
	return fmt.Sprintf("Rs.%.0f", v)
}
