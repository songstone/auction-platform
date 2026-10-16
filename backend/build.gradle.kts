import org.springframework.boot.gradle.plugin.SpringBootPlugin

plugins {
    java
    id("org.springframework.boot") version "3.5.16"
}

group = "com.auctionplatform"
version = "0.1.0-SNAPSHOT"
description = "Implementation scaffold for the approved auction architecture; no business endpoints yet."

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // Preserve the versions managed by the former Spring Boot parent without another plugin.
    implementation(enforcedPlatform(SpringBootPlugin.BOM_COORDINATES))
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test") {
        // Existing tests use actual HTTP and architecture fixtures, not an agent-based mock maker.
        exclude(group = "org.mockito", module = "mockito-core")
        exclude(group = "org.mockito", module = "mockito-junit-jupiter")
    }
    testImplementation("com.tngtech.archunit:archunit:1.5.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

dependencyLocking {
    lockAllConfigurations()
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.release = 25
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}

springBoot {
    mainClass = "com.auctionplatform.bootstrap.AuctionPlatformApplication"
}

// The launcher has one deployable JAR to select; do not emit a second plain JAR.
tasks.jar {
    enabled = false
}

tasks.wrapper {
    gradleVersion = "9.8.1"
    distributionType = Wrapper.DistributionType.BIN
    distributionSha256Sum = "dce76f55f8e251a3a1f130eb120f30b3d271de2b76c9b0729d316b5a1b6dc01f"
}
