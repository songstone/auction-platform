package com.auctionplatform.architecture;

import com.auctionplatform.auction.domain.fixtures.FrameworkCoupledRule;
import com.auctionplatform.auction.domain.fixtures.PlainValue;
import com.auctionplatform.listing.domain.fixtures.ForbiddenAuctionReference;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ArchitectureRulesTest {
    @Test
    void productionClassesRespectFeatureAndLayerBoundaries() {
        JavaClasses production = new ClassFileImporter()
                .withImportOption(new ImportOption.DoNotIncludeTests())
                .importPackages(ArchitectureRules.ROOT);

        assertThat(production).isNotEmpty();
        ArchitectureRules.DOMAIN_IS_PURE.check(production);
        ArchitectureRules.APPLICATION_AVOIDS_ADAPTERS.check(production);
        ArchitectureRules.NO_AUCTION_CALLBACK.check(production);
        ArchitectureRules.NO_FEATURE_TO_BOOTSTRAP.check(production);
        ArchitectureRules.FEATURES_ARE_ACYCLIC.check(production);
        ArchitectureRules.CROSS_FEATURE_ACCESS_USES_PUBLIC_API.check(production);
    }

    @Test
    void domainGuardRejectsARealFrameworkDependency() {
        JavaClasses forbidden = new ClassFileImporter().importClasses(FrameworkCoupledRule.class);
        assertThat(ArchitectureRules.DOMAIN_IS_PURE.evaluate(forbidden).hasViolation()).isTrue();
        JavaClasses plain = new ClassFileImporter().importClasses(PlainValue.class);
        assertThat(ArchitectureRules.DOMAIN_IS_PURE.evaluate(plain).hasViolation()).isFalse();
    }

    @Test
    void moduleGuardRejectsAnInternalCrossFeatureDependency() {
        JavaClasses forbidden = new ClassFileImporter().importClasses(ForbiddenAuctionReference.class);
        assertThat(ArchitectureRules.CROSS_FEATURE_ACCESS_USES_PUBLIC_API
                .evaluate(forbidden).hasViolation()).isTrue();
        assertThat(ArchitectureRules.NO_AUCTION_CALLBACK.evaluate(forbidden).hasViolation()).isTrue();
    }
}
