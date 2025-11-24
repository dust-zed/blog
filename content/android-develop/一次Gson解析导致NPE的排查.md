+++
date = '2025-11-05T13:20:21+08:00'
draft = true
title = '一次Gson解析导致NPE的排查'
categories = ['android-develop']

+++

#### 问题描述

使用Gson库解析出Kotlin对象时，其中的非空变量在使用时意外的出现了NPE。

#### 问题定位

Gson为了性能，使用了`Unsafe.allocateInstance()`直接分配内存创建对象，绕过了构造函数。而Kotlin的非空检查是在构造函数里做的，所以非空检查被绕过了。

#### 解决思路

* 给DataClass的所有字段加默认值，使其具备默认构造函数
* 或者自定义TypeAdapterFactory

#### Gson的核心架构

##### 整体流程

```
JSON字符串 
    ↓
JsonReader (逐个读取token)
    ↓
TypeAdapter (解析并构造对象)
    ↓
Java/Kotlin对象
```

##### Gson的三层架构

```java
// 1. Gson - 入口
Gson gson = new Gson();
User user = gson.fromJson(json, User.class);

// 2. TypeAdapter - 具体的序列化/反序列化逻辑
TypeAdapter<User> adapter = gson.getAdapter(User.class);
User user = adapter.read(jsonReader);

// 3. TypeAdapterFactory - 创建TypeAdapter的工厂
TypeAdapterFactory factory = new MyTypeAdapterFactory();
TypeAdapter<User> adapter = factory.create(gson, TypeToken.get(User.class));
```

##### TypeAdapter的核心方法

```java
public abstract class TypeAdapter<T> {
    
    /**
     * 从JSON读取,构造对象(反序列化)
     */
    public abstract T read(JsonReader in) throws IOException;
    
    /**
     * 将对象写入JSON(序列化)
     */
    public abstract void write(JsonWriter out, T value) throws IOException;
    
    /**
     * 从JSON字符串反序列化
     */
    public final T fromJson(String json) {
        return read(new JsonReader(new StringReader(json)));
    }
    
    /**
     * 序列化为JSON字符串
     */
    public final String toJson(T value) {
        StringWriter writer = new StringWriter();
        write(new JsonWriter(writer), value);
        return writer.toString();
    }
}
```

##### Gson的反序列化流程

* 先尝试无参构造函数
* 失败后用Unsafe.allocateInstance()直接分配内存
* 通过反射设置字段值

#### 自定义TypeAdapter

##### TypeAdapterFactory

```kotlin
class NullSafeTypeAdapterFactory : TypeAdapterFactory {
    
    override fun <T> create(gson: Gson, type: TypeToken<T>): TypeAdapter<T>? {
        val rawType = type.rawType
        
        // 只处理Kotlin的Data Class
        if (!rawType.isKotlinClass()) {
            return null
        }
        
        // 获取Gson的默认Adapter
        val delegateAdapter = gson.getDelegateAdapter(this, type)
        
        // 包装一层,处理null值
        return NullSafeTypeAdapter(delegateAdapter, rawType)
    }
}

class NullSafeTypeAdapter<T>(
    private val delegate: TypeAdapter<T>,
    private val rawType: Class<*>
) : TypeAdapter<T>() {
    
    override fun read(reader: JsonReader): T {
        // 先用代理Adapter读取
        val result = delegate.read(reader)
        
        // 检查非空字段
        if (result != null) {
            checkNonNullFields(result)
        }
        
        return result
    }
    
    override fun write(writer: JsonWriter, value: T?) {
        delegate.write(writer, value)
    }
    
    /**
     * 检查非空字段是否真的非空
     */
    private fun checkNonNullFields(obj: Any) {
        val kClass = rawType.kotlin
        
        // 获取所有构造函数参数(Data Class的属性)
        val constructor = kClass.primaryConstructor ?: return
        
        for (param in constructor.parameters) {
            // 检查是否非空类型
            if (!param.type.isMarkedNullable) {
                // 获取字段值
                val field = rawType.getDeclaredField(param.name)
                field.isAccessible = true
                val value = field.get(obj)
                
                // 如果是null,抛异常或设置默认值
                if (value == null) {
                    // 方案1:抛异常
                    throw JsonParseException(
                        "Non-null field '${param.name}' was null in ${rawType.simpleName}"
                    )
                    
                    // 方案2:设置默认值(需要反射改字段)
                    // field.set(obj, getDefaultValue(param.type))
                }
            }
        }
    }
}

// 扩展函数:判断是否Kotlin类
fun Class<*>.isKotlinClass(): Boolean {
    return this.declaredAnnotations.any { 
        it.annotationClass.qualifiedName == "kotlin.Metadata" 
    }
}
```

##### 注册Factory

```kotlin
val gson = GsonBuilder()
    .registerTypeAdapterFactory(NullSafeTypeAdapterFactory())
    .create()

// 所有Data Class都会被自动处理
val user = gson.fromJson(json, User::class.java)
val product = gson.fromJson(json, Product::class.java)
```

#### Gson如何选择TypeAdapter

##### 完整流程

```java
// 用户调用
gson.fromJson(json, User.class)

// Gson内部
public <T> T fromJson(String json, Class<T> classOfT) {
    // 1. 包装成TypeToken
    TypeToken<T> typeToken = TypeToken.get(classOfT);
    
    // 2. 获取TypeAdapter
    TypeAdapter<T> adapter = getAdapter(typeToken);
    
    // 3. 反序列化
    return adapter.fromJson(json);
}
```

##### getAdapter的逻辑

```java
// Gson.java (简化版)
public class Gson {
    
    // 所有注册的Factory,按顺序排列
    private final List<TypeAdapterFactory> factories;
    
    // TypeAdapter缓存
    private final Map<TypeToken<?>, TypeAdapter<?>> typeTokenCache = 
        new ConcurrentHashMap<>();
    
    public <T> TypeAdapter<T> getAdapter(TypeToken<T> type) {
        // 1. 先从缓存取
        TypeAdapter<T> cached = (TypeAdapter<T>) typeTokenCache.get(type);
        if (cached != null) {
            return cached;
        }
        
        // 2. 遍历所有Factory,找到第一个能处理的
        for (TypeAdapterFactory factory : factories) {
            TypeAdapter<T> adapter = factory.create(this, type);
            
            if (adapter != null) {
                // 3. 找到了,缓存起来
                typeTokenCache.put(type, adapter);
                return adapter;
            }
        }
        
        // 4. 都找不到,抛异常
        throw new IllegalArgumentException("Cannot handle " + type);
    }
}
```

##### Factory的注册顺序

```java
// GsonBuilder.java
public Gson create() {
    List<TypeAdapterFactory> factories = new ArrayList<>();
    
    // 1. 用户自定义的Factory (最高优先级!)
    factories.addAll(this.factories);
    
    // 2. 用户通过registerTypeAdapter注册的
    factories.add(new TypeAdapters.newFactory(type, adapter));
    
    // 3. Gson内置的基础类型Factory
    factories.add(TypeAdapters.STRING_FACTORY);      // String
    factories.add(TypeAdapters.INTEGER_FACTORY);     // Integer
    factories.add(TypeAdapters.BOOLEAN_FACTORY);     // Boolean
    // ... 其他基础类型
    
    // 4. Collection类型
    factories.add(new CollectionTypeAdapterFactory());
    
    // 5. Map类型  
    factories.add(new MapTypeAdapterFactory());
    
    // 6. 数组类型
    factories.add(new ArrayTypeAdapterFactory());
    
    // 7. Enum类型
    factories.add(new EnumTypeAdapterFactory());
    
    // 8. 反射类型 (最低优先级,兜底方案!)
    factories.add(new ReflectiveTypeAdapterFactory());
    
    return new Gson(factories);
}
```

**关键**:

- 你自定义的Factory优先级最高
- ReflectiveTypeAdapterFactory是兜底,处理所有普通Java/Kotlin对象
- 调用getDelegateAdapter,让后面的Factory处理,可以做到**增强**factory
