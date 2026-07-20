执行顺序：
1. 读取模板包，理解角色、场景、脚本槽位和素材需求。
2. 读取素材库，查看每个素材的 type、tags、text 和 image_path。
3. 对脚本槽位逐一匹配素材，优先满足明确的 needMaterial。
4. 生成 AssemblyResult JSON。
5. 用户确认后调用 apply_assembly 保存结果。
