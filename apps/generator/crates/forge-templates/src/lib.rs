use anyhow::Result;
use serde::Serialize;
use std::collections::HashMap;
use tera::{Context, Tera};

pub struct TemplateEngine {
    tera: Tera,
}

impl TemplateEngine {
    /// Create an engine with templates loaded from raw string pairs.
    pub fn from_strings(templates: &[(&str, &str)]) -> Result<Self> {
        let mut tera = Tera::default();
        for (name, content) in templates {
            tera.add_raw_template(name, content)?;
        }
        Ok(Self { tera })
    }

    pub fn render<T: Serialize>(&self, template_name: &str, data: &T) -> Result<String> {
        let ctx = Context::from_serialize(data)?;
        Ok(self.tera.render(template_name, &ctx)?)
    }

    pub fn render_map(&self, template_name: &str, vars: HashMap<&str, serde_json::Value>) -> Result<String> {
        let mut ctx = Context::new();
        for (k, v) in vars {
            ctx.insert(k, &v);
        }
        Ok(self.tera.render(template_name, &ctx)?)
    }
}
