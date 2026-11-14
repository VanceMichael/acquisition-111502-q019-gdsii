# 来源资料契约

支持 GDSII HEADER/BGNLIB/LIBNAME/UNITS、结构、BOUNDARY/PATH/TEXT、SREF/AREF、层号、数据类型、坐标、属性与 STRANS/MAG/ANGLE。REAL8 是 GDS 基16实数，坐标保留整数与单位声明。cell-reference 的 value 含 parent、target、kind、columns、rows、origin、columnEndpoint、rowEndpoint；AREF 三个 XY 点是原声明端点，不预先展开巨型实例。element 保留所属结构、层及字节范围。应能查询实例路径并说明继承/绝对变换，循环引用与缺单元不视为无几何。

每条已解释资料均可回到真实来源收件和具体位置。原始载荷与版本必须继续可查，不能以解析后的摘要替代原文。未列出的标准扩展允许明确标识未支持，不允许假称已解释。

instance-path 的 value 用 structures 保存结构路径，multiplicity 表示符号阵列实例数量；同一路径若有不同变换应可分别辨识，查询不得实际展开巨型阵列。
