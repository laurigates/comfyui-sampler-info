# Changelog

## [0.1.1](https://github.com/laurigates/comfyui-sampler-info/compare/comfyui-sampler-info-v0.1.0...comfyui-sampler-info-v0.1.1) (2026-05-29)


### Features

* **corpus:** add coverage for Wan/Hunyuan/FramePack/HiDream wrappers ([dfad24b](https://github.com/laurigates/comfyui-sampler-info/commit/dfad24ba0505cb94bbb1c32bdec503cfc990e2d8))
* **corpus:** soften prescriptive good_for, expand too-terse entries ([e5edde4](https://github.com/laurigates/comfyui-sampler-info/commit/e5edde498c87e4f2f32be0351bc26d19015f8ea7))
* **docs:** containerized README screenshot generator ([#20](https://github.com/laurigates/comfyui-sampler-info/issues/20)) ([04b89fb](https://github.com/laurigates/comfyui-sampler-info/commit/04b89fb6f34b91113fe5dbd313fc3f20819ff6e2))
* initial release scaffold ([60a3d1c](https://github.com/laurigates/comfyui-sampler-info/commit/60a3d1ce7ccc80a50bcc115ca023ba4e47076e40))
* **picker:** center current value in modal on open ([#21](https://github.com/laurigates/comfyui-sampler-info/issues/21)) ([73900f2](https://github.com/laurigates/comfyui-sampler-info/commit/73900f284e545ca8052bd89ea9d14229f173eeb1))
* **test:** adopt Vitest, migrate Biome v2, close TRP-001 backlog ([#22](https://github.com/laurigates/comfyui-sampler-info/issues/22)) ([e3e22a9](https://github.com/laurigates/comfyui-sampler-info/commit/e3e22a95e37b0098a8adcfc58f58e3bf393cb775))


### Bug Fixes

* **blueprint:** mark all v0.1.0 features complete, advance tracker to v0.1.x phase ([ddcba4d](https://github.com/laurigates/comfyui-sampler-info/commit/ddcba4d394f11d37da24b46d5f2f4c691796e685))
* **blueprint:** remove empty shadow dirs that contradicted blueprint layout ([c1f5f00](https://github.com/laurigates/comfyui-sampler-info/commit/c1f5f004eee91388194b9a7379948e9d5ba6f494))
* **ci:** grant release-please workflow write permissions ([#26](https://github.com/laurigates/comfyui-sampler-info/issues/26)) ([2ac7f25](https://github.com/laurigates/comfyui-sampler-info/commit/2ac7f25ecd6c5f6e0273c55611477277b514d82f))
* **ci:** pin Biome to 1.9.4 and unshallow checkout for gitleaks ([#19](https://github.com/laurigates/comfyui-sampler-info/issues/19)) ([1872699](https://github.com/laurigates/comfyui-sampler-info/commit/1872699ade9de103632c65dc02b3041c2ebc8981))
* **picker:** use pointerdown not click for backdrop dismiss ([4249353](https://github.com/laurigates/comfyui-sampler-info/commit/4249353e4b5bbe423f99e5fcfab4fa40e067251d))
* **rules:** add paths: frontmatter to unscoped rules; fix document-management paths ([8067889](https://github.com/laurigates/comfyui-sampler-info/commit/8067889b3f5ec8701edd716fae2f60c7b64d024c))
* **screenshots:** rename ignore-file so BuildKit consults it ([#29](https://github.com/laurigates/comfyui-sampler-info/issues/29)) ([7e5ef4c](https://github.com/laurigates/comfyui-sampler-info/commit/7e5ef4ce0015469a27eb19e94de8bd7e9c480b38))


### Documentation

* add CLAUDE.md with pack-local context ([#1](https://github.com/laurigates/comfyui-sampler-info/issues/1)) ([4b37fb5](https://github.com/laurigates/comfyui-sampler-info/commit/4b37fb5254ff4205f787e0802b4e3c654a13ab82))
* **blueprint:** integrate CLAUDE.md with blueprint, link 10 docs to issues [#6](https://github.com/laurigates/comfyui-sampler-info/issues/6)-15 ([a8157cd](https://github.com/laurigates/comfyui-sampler-info/commit/a8157cd4779a255b563b48857cf1e1073795ae90))
* **release:** note the feature-branch → main rename in checklist ([7ab0a77](https://github.com/laurigates/comfyui-sampler-info/commit/7ab0a77098b695fbceec4f8306491f5b33a3c7f1))
* **rules:** capture touch-modal dismiss pattern in api-conventions ([e92270e](https://github.com/laurigates/comfyui-sampler-info/commit/e92270e09d5060e5b0c3f034111cf9b28096be5a))


### Miscellaneous

* automated onboard run ([#2](https://github.com/laurigates/comfyui-sampler-info/issues/2)) ([aba71a5](https://github.com/laurigates/comfyui-sampler-info/commit/aba71a596bbfc77587024d90e3ab9003be1614ce))
* **deps:** Bump actions/checkout from 4 to 6 ([#3](https://github.com/laurigates/comfyui-sampler-info/issues/3)) ([a462e22](https://github.com/laurigates/comfyui-sampler-info/commit/a462e224bacbdda856bb65fbcd5bad2640dccd64))
* **deps:** Bump actions/setup-node from 4 to 6 ([#24](https://github.com/laurigates/comfyui-sampler-info/issues/24)) ([e85cbae](https://github.com/laurigates/comfyui-sampler-info/commit/e85cbae59a17911c52a43b0d2110efebae053e6c))
* **deps:** Bump astral-sh/setup-uv from 6 to 7 ([#4](https://github.com/laurigates/comfyui-sampler-info/issues/4)) ([8b3f5e9](https://github.com/laurigates/comfyui-sampler-info/commit/8b3f5e99bf66736c14a29dee595dc62939a764b1))
* **release:** set Comfy Registry PublisherId to laurigates ([#23](https://github.com/laurigates/comfyui-sampler-info/issues/23)) ([44cd5ea](https://github.com/laurigates/comfyui-sampler-info/commit/44cd5ea3cf6b5e651cc18bac5c8cb0cb0cc2811d))
* scaffold release-please for automated versioning ([#25](https://github.com/laurigates/comfyui-sampler-info/issues/25)) ([9e9adca](https://github.com/laurigates/comfyui-sampler-info/commit/9e9adcaee564973e594277332c67c97b63e11c8b))
