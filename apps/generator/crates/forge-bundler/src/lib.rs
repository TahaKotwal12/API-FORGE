use anyhow::Result;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Write;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedFile {
    /// Relative path from the output root, e.g. `src/models/user.ts`.
    pub path: String,
    pub content: String,
    pub exec_bit: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub apiforge_generator_version: String,
    pub spec_hash: String,
    pub language: String,
    pub mode: String,
    pub generated_at: String,
    pub files: Vec<ManifestFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestFile {
    pub path: String,
    pub sha256: String,
    pub size: usize,
}

pub struct Bundle {
    pub files: Vec<GeneratedFile>,
    pub manifest: Manifest,
}

impl Bundle {
    pub fn new(files: Vec<GeneratedFile>, spec_hash: &str, language: &str, mode: &str) -> Self {
        let manifest_files: Vec<ManifestFile> = files
            .iter()
            .map(|f| {
                let mut h = Sha256::new();
                h.update(f.content.as_bytes());
                ManifestFile {
                    path: f.path.clone(),
                    sha256: hex::encode(h.finalize()),
                    size: f.content.len(),
                }
            })
            .collect();

        let manifest = Manifest {
            apiforge_generator_version: env!("CARGO_PKG_VERSION").to_string(),
            spec_hash: spec_hash.to_string(),
            language: language.to_string(),
            mode: mode.to_string(),
            generated_at: Utc::now().to_rfc3339(),
            files: manifest_files,
        };

        Self { files, manifest }
    }

    /// Serialize to a zip archive in memory.
    pub fn to_zip(&self) -> Result<Vec<u8>> {
        let buf = Vec::new();
        let cursor = std::io::Cursor::new(buf);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::FileOptions::<()>::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for file in &self.files {
            zip.start_file(&file.path, options)?;
            zip.write_all(file.content.as_bytes())?;
        }

        // Write manifest
        let manifest_json = serde_json::to_string_pretty(&self.manifest)?;
        zip.start_file("manifest.json", options)?;
        zip.write_all(manifest_json.as_bytes())?;

        Ok(zip.finish()?.into_inner())
    }

    /// Write files to a directory on disk.
    pub fn write_to_dir(&self, dir: &std::path::Path) -> Result<()> {
        for file in &self.files {
            let path = dir.join(&file.path);
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&path, &file.content)?;
        }
        // Write manifest alongside
        let manifest_json = serde_json::to_string_pretty(&self.manifest)?;
        std::fs::write(dir.join("manifest.json"), manifest_json)?;
        Ok(())
    }
}

pub fn spec_hash(spec: &str) -> String {
    let mut h = Sha256::new();
    h.update(spec.as_bytes());
    hex::encode(h.finalize())
}
