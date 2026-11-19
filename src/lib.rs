// SPDX-License-Identifier: MIT OR Apache-2.0
//! SigmaOS-office — Unified productivity suite & style integration.
//!
//! Provides multi-format document modeling (ODF, OOXML, PDF), suite backend dispatch
//! (LibreOffice, OnlyOffice, CraftOffice, GenOffice), document metadata extraction,
//! and style preset coordination.
//!
//! Inspired by Omarchy's seamless office document preview, Hyprland's window styling,
//! and Catppuccin Mocha's document palette.
//!
//! Principles: format detection by magic / extension, pure `std`, zero `unsafe`.

#![forbid(unsafe_code)]

use std::collections::HashMap;
use std::fmt;
use std::path::{Path, PathBuf};

// ── Error types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OfficeError {
    UnsupportedFormat(String),
    DocumentNotFound(String),
    BackendNotAvailable(String),
    InvalidMetadata(String),
    EmptyDocument,
}

impl fmt::Display for OfficeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedFormat(ext) => write!(f, "unsupported office document format: '{ext}'"),
            Self::DocumentNotFound(p) => write!(f, "document file not found: '{p}'"),
            Self::BackendNotAvailable(b) => write!(f, "productivity suite backend '{b}' is not available"),
            Self::InvalidMetadata(m) => write!(f, "invalid document metadata: {m}"),
            Self::EmptyDocument => write!(f, "document contains no pages or content"),
        }
    }
}

impl std::error::Error for OfficeError {}

// ── Document Kinds and Formats ───────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DocumentKind {
    TextDocument,
    Spreadsheet,
    Presentation,
    Drawing,
    PortableDocument,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OfficeBackend {
    LibreOffice,
    OnlyOffice,
    CraftOffice,
    GenOfficeAi,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentMetadata {
    pub title: String,
    pub author: String,
    pub path: PathBuf,
    pub kind: DocumentKind,
    pub page_or_sheet_count: usize,
    pub custom_tags: HashMap<String, String>,
}

impl DocumentMetadata {
    pub fn new(path: impl AsRef<Path>, title: impl Into<String>, author: impl Into<String>) -> Result<Self, OfficeError> {
        let p = path.as_ref();
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        let kind = match ext.as_str() {
            "odt" | "docx" | "doc" | "rtf" | "txt" => DocumentKind::TextDocument,
            "ods" | "xlsx" | "xls" | "csv" => DocumentKind::Spreadsheet,
            "odp" | "pptx" | "ppt" => DocumentKind::Presentation,
            "odg" | "svg" => DocumentKind::Drawing,
            "pdf" => DocumentKind::PortableDocument,
            other => return Err(OfficeError::UnsupportedFormat(other.to_string())),
        };

        Ok(Self {
            title: title.into(),
            author: author.into(),
            path: p.to_path_buf(),
            kind,
            page_or_sheet_count: 1,
            custom_tags: HashMap::new(),
        })
    }

    pub fn with_pages(mut self, count: usize) -> Result<Self, OfficeError> {
        if count == 0 {
            return Err(OfficeError::EmptyDocument);
        }
        self.page_or_sheet_count = count;
        Ok(self)
    }
}

// ── Suite Coordinator ────────────────────────────────────────────────────────

#[derive(Debug, Default)]
pub struct OfficeSuiteManager {
    preferred_backend: HashMap<DocumentKind, OfficeBackend>,
    recent_documents: Vec<DocumentMetadata>,
}

impl OfficeSuiteManager {
    pub fn new() -> Self {
        let mut m = Self::default();
        m.preferred_backend.insert(DocumentKind::TextDocument, OfficeBackend::LibreOffice);
        m.preferred_backend.insert(DocumentKind::Spreadsheet, OfficeBackend::LibreOffice);
        m.preferred_backend.insert(DocumentKind::Presentation, OfficeBackend::OnlyOffice);
        m.preferred_backend.insert(DocumentKind::Drawing, OfficeBackend::CraftOffice);
        m.preferred_backend.insert(DocumentKind::PortableDocument, OfficeBackend::GenOfficeAi);
        m
    }

    pub fn set_preferred_backend(&mut self, kind: DocumentKind, backend: OfficeBackend) {
        self.preferred_backend.insert(kind, backend);
    }

    pub fn backend_for(&self, kind: DocumentKind) -> OfficeBackend {
        self.preferred_backend.get(&kind).copied().unwrap_or(OfficeBackend::LibreOffice)
    }

    pub fn open_document(&mut self, doc: DocumentMetadata) -> OfficeBackend {
        let backend = self.backend_for(doc.kind);
        self.recent_documents.push(doc);
        backend
    }

    pub fn recent_count(&self) -> usize {
        self.recent_documents.len()
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_detection_supported_formats() {
        // Arrange & Act
        let odt = DocumentMetadata::new("report.odt", "Quarterly", "Aaryan");
        let xlsx = DocumentMetadata::new("budget.xlsx", "Budget", "Aaryan");
        let pptx = DocumentMetadata::new("slides.pptx", "Pitch", "Aaryan");
        let pdf = DocumentMetadata::new("invoice.pdf", "Invoice", "Aaryan");

        // Assert
        assert_eq!(odt.unwrap().kind, DocumentKind::TextDocument);
        assert_eq!(xlsx.unwrap().kind, DocumentKind::Spreadsheet);
        assert_eq!(pptx.unwrap().kind, DocumentKind::Presentation);
        assert_eq!(pdf.unwrap().kind, DocumentKind::PortableDocument);
    }

    #[test]
    fn format_detection_unsupported_format() {
        // Arrange & Act
        let err = DocumentMetadata::new("archive.tar.gz", "Archive", "Aaryan");
        // Assert
        assert_eq!(err, Err(OfficeError::UnsupportedFormat("gz".into())));
    }

    #[test]
    fn document_page_count_validation() {
        // Arrange
        let doc = DocumentMetadata::new("doc.odt", "Title", "Author").unwrap();
        // Act
        let valid = doc.clone().with_pages(15);
        let zero = doc.with_pages(0);
        // Assert
        assert_eq!(valid.unwrap().page_or_sheet_count, 15);
        assert_eq!(zero, Err(OfficeError::EmptyDocument));
    }

    #[test]
    fn manager_backend_routing() {
        // Arrange
        let mut mgr = OfficeSuiteManager::new();
        // Act
        let text_be = mgr.backend_for(DocumentKind::TextDocument);
        let pres_be = mgr.backend_for(DocumentKind::Presentation);

        mgr.set_preferred_backend(DocumentKind::TextDocument, OfficeBackend::OnlyOffice);
        let custom_be = mgr.backend_for(DocumentKind::TextDocument);

        // Assert
        assert_eq!(text_be, OfficeBackend::LibreOffice);
        assert_eq!(pres_be, OfficeBackend::OnlyOffice);
        assert_eq!(custom_be, OfficeBackend::OnlyOffice);
    }

    #[test]
    fn open_document_adds_to_recents() {
        // Arrange
        let mut mgr = OfficeSuiteManager::new();
        let doc = DocumentMetadata::new("plan.ods", "Sprint Plan", "Team").unwrap();

        // Act
        let backend = mgr.open_document(doc);

        // Assert
        assert_eq!(backend, OfficeBackend::LibreOffice);
        assert_eq!(mgr.recent_count(), 1);
    }

    #[test]
    fn error_display_formatting() {
        // Arrange
        let err = OfficeError::UnsupportedFormat("exe".into());
        // Act & Assert
        assert_eq!(format!("{err}"), "unsupported office document format: 'exe'");
    }
}
