package com.auctionplatform.architecture;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

import java.util.Set;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

final class ArchitectureRules {
    static final String ROOT = "com.auctionplatform";
    private static final Set<String> FEATURES = Set.of(
            "identity", "listing", "auction", "query", "realtime", "bootstrap");

    static final ArchRule DOMAIN_IS_PURE = noClasses()
            .that().resideInAPackage(ROOT + "..domain..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "java.sql..", "javax.sql..", "jakarta.servlet..",
                    ROOT + "..application..", ROOT + "..infrastructure..", ROOT + ".bootstrap..")
            .allowEmptyShould(true);

    static final ArchRule APPLICATION_AVOIDS_ADAPTERS = noClasses()
            .that().resideInAnyPackage(ROOT + "..application..", ROOT + "..publicapi..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    ROOT + "..infrastructure..", ROOT + ".bootstrap..")
            .allowEmptyShould(true);

    static final ArchRule NO_AUCTION_CALLBACK = noClasses()
            .that().resideInAnyPackage(ROOT + ".listing..", ROOT + ".identity..")
            .should().dependOnClassesThat().resideInAPackage(ROOT + ".auction..")
            .allowEmptyShould(true);

    static final ArchRule NO_FEATURE_TO_BOOTSTRAP = noClasses()
            .that().resideInAnyPackage(
                    ROOT + ".identity..", ROOT + ".listing..", ROOT + ".auction..",
                    ROOT + ".query..", ROOT + ".realtime..")
            .should().dependOnClassesThat().resideInAPackage(ROOT + ".bootstrap..")
            .allowEmptyShould(true);

    static final ArchRule FEATURES_ARE_ACYCLIC = slices().matching(ROOT + ".(*)..")
            .should().beFreeOfCycles();

    static final ArchRule CROSS_FEATURE_ACCESS_USES_PUBLIC_API = classes()
            .should(new ArchCondition<>("use only another feature's publicapi outside composition") {
                @Override
                public void check(JavaClass source, ConditionEvents events) {
                    String sourceFeature = feature(source);
                    if (sourceFeature == null || sourceFeature.equals("bootstrap")) return;
                    for (Dependency dependency : source.getDirectDependenciesFromSelf()) {
                        JavaClass target = dependency.getTargetClass();
                        String targetFeature = feature(target);
                        if (targetFeature == null || sourceFeature.equals(targetFeature)) continue;
                        String publicRoot = ROOT + "." + targetFeature + ".publicapi";
                        boolean publicApi = target.getPackageName().equals(publicRoot)
                                || target.getPackageName().startsWith(publicRoot + ".");
                        events.add(new SimpleConditionEvent(dependency, publicApi,
                                dependency.getDescription()));
                    }
                }
            });

    private static String feature(JavaClass type) {
        String prefix = ROOT + ".";
        if (!type.getPackageName().startsWith(prefix)) return null;
        String name = type.getPackageName().substring(prefix.length()).split("\\.", 2)[0];
        return FEATURES.contains(name) ? name : null;
    }

    private ArchitectureRules() {}
}
