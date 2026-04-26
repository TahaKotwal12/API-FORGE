use anyhow::{Context, Result};
use clap::{Parser, ValueEnum};
use forge_bundler::{spec_hash, Bundle};
use forge_ir::EmitOptions;
use forge_linter::lint;
use forge_parser::parse;
use std::path::{Path, PathBuf};

#[derive(Parser)]
#[command(name = "forge-gen", about = "APIForge code generator", version)]
struct Cli {
    /// Path to the OpenAPI spec file (YAML or JSON).
    #[arg(short, long)]
    spec: PathBuf,

    /// Target language.
    #[arg(short, long)]
    lang: Language,

    /// Generator mode.
    #[arg(short, long, default_value = "sdk")]
    mode: Mode,

    /// Output directory (default: ./generated).
    #[arg(short, long, default_value = "generated")]
    out: PathBuf,

    /// Package / crate / module name.
    #[arg(long)]
    package_name: Option<String>,

    /// Package version override.
    #[arg(long)]
    package_version: Option<String>,

    /// Print diagnostics even if generation succeeds.
    #[arg(long)]
    show_diagnostics: bool,

    /// Exit with code 3 if linting produces errors.
    #[arg(long)]
    strict: bool,
}

#[derive(Clone, ValueEnum)]
enum Language {
    #[value(alias = "ts")]
    Typescript,
    Java,
    #[value(alias = "py")]
    Python,
    Go,
    #[value(alias = "rs")]
    Rust,
}

#[derive(Clone, ValueEnum)]
enum Mode {
    #[value(name = "dto-only")]
    DtoOnly,
    Sdk,
    Server,
    Hooks,
}

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {:#}", e);
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = Cli::parse();

    let spec_str = std::fs::read_to_string(&cli.spec)
        .with_context(|| format!("reading {}", cli.spec.display()))?;

    let api = parse(&spec_str)
        .with_context(|| "parsing OpenAPI spec")?;

    let lint_result = lint(&api);
    if cli.show_diagnostics || lint_result.has_errors() {
        for d in &lint_result.diagnostics {
            eprintln!("[{:?}] {} — {}", d.severity, d.code, d.message);
        }
    }
    if cli.strict && lint_result.has_errors() {
        std::process::exit(3);
    }

    let opts = EmitOptions {
        mode: match cli.mode {
            Mode::DtoOnly => forge_ir::GeneratorMode::DtoOnly,
            Mode::Server  => forge_ir::GeneratorMode::Server,
            Mode::Hooks   => forge_ir::GeneratorMode::Hooks,
            Mode::Sdk     => forge_ir::GeneratorMode::Sdk,
        },
        package_name: cli.package_name,
        package_version: cli.package_version,
        extra: indexmap::IndexMap::new(),
    };

    let files = match cli.lang {
        Language::Typescript => emitter_typescript::emit(&api, &opts),
        Language::Java       => emitter_java::emit(&api, &opts),
        Language::Python     => emitter_python::emit(&api, &opts),
        Language::Go         => emitter_go::emit(&api, &opts),
        Language::Rust       => emitter_rust::emit(&api, &opts),
    }.context("generating code")?;

    let hash = spec_hash(&spec_str);
    let mode_str = format!("{:?}", opts.mode).to_lowercase().replace(' ', "-");
    let lang_str = format!("{:?}", cli.lang).to_lowercase();
    let bundle = Bundle::new(files, &hash, &lang_str, &mode_str);

    if !cli.out.exists() {
        std::fs::create_dir_all(&cli.out)?;
    }
    bundle.write_to_dir(&cli.out)?;

    println!("Generated {} {} files → {}", lang_str, mode_str, cli.out.display());
    println!("Spec hash: {}", hash);
    println!("Files written: {}", bundle.manifest.files.len());

    Ok(())
}
