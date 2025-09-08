#!/bin/bash

# Script to teardown all infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/infrastructure/terraform"
BOOTSTRAP_DIR="$TERRAFORM_DIR/bootstrap"

print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Safety check
safety_check() {
    print_message "$RED" "⚠️  WARNING: This will destroy ALL infrastructure!"
    print_message "$RED" "This action cannot be undone and will delete:"
    echo "  - All ECS services and tasks"
    echo "  - Aurora database and all data"
    echo "  - ElastiCache Redis cluster"
    echo "  - VPC and networking resources"
    echo "  - ECR repositories and images"
    echo "  - Secrets in Secrets Manager"
    echo "  - S3 buckets (after manual emptying)"
    echo ""
    
    read -p "Type 'DESTROY' to confirm: " confirmation
    
    if [ "$confirmation" != "DESTROY" ]; then
        print_message "$GREEN" "Teardown cancelled"
        exit 0
    fi
    
    print_message "$YELLOW" "Second confirmation required..."
    read -p "Are you absolutely sure? (yes/no): " second_confirmation
    
    if [ "$second_confirmation" != "yes" ]; then
        print_message "$GREEN" "Teardown cancelled"
        exit 0
    fi
}

# Destroy main infrastructure
destroy_main_infrastructure() {
    print_message "$BLUE" "\n=== Destroying Main Infrastructure ==="
    
    cd "$TERRAFORM_DIR"
    
    # Check if terraform is initialized
    if [ ! -d ".terraform" ]; then
        print_message "$YELLOW" "Terraform not initialized, initializing..."
        
        # Get backend config from bootstrap outputs
        if [ -f "bootstrap-outputs.json" ]; then
            STATE_BUCKET=$(jq -r '.state_bucket_name.value' bootstrap-outputs.json)
            LOCK_TABLE=$(jq -r '.lock_table_name.value' bootstrap-outputs.json)
            
            terraform init \
                -backend-config="bucket=$STATE_BUCKET" \
                -backend-config="key=terraform.tfstate" \
                -backend-config="region=${AWS_DEFAULT_REGION:-us-east-1}" \
                -backend-config="dynamodb_table=$LOCK_TABLE"
        else
            print_message "$YELLOW" "⚠️  Bootstrap outputs not found, skipping main infrastructure"
            return
        fi
    fi
    
    # List workspaces
    print_message "$YELLOW" "Available workspaces:"
    terraform workspace list
    
    # Destroy each workspace
    for workspace in $(terraform workspace list | grep -v default | sed 's/*//' | tr -d ' '); do
        if [ ! -z "$workspace" ]; then
            print_message "$YELLOW" "Destroying workspace: $workspace"
            terraform workspace select $workspace
            
            # Check if tfvars file exists
            if [ -f "environments/$workspace/terraform.tfvars" ]; then
                terraform destroy -var-file="environments/$workspace/terraform.tfvars" -auto-approve
            else
                terraform destroy -auto-approve
            fi
        fi
    done
    
    # Return to default workspace
    terraform workspace select default
    
    print_message "$GREEN" "✅ Main infrastructure destroyed"
}

# Empty S3 buckets
empty_s3_buckets() {
    print_message "$BLUE" "\n=== Emptying S3 Buckets ==="
    
    # Get bucket name from bootstrap outputs
    if [ -f "$TERRAFORM_DIR/bootstrap-outputs.json" ]; then
        STATE_BUCKET=$(jq -r '.state_bucket_name.value' "$TERRAFORM_DIR/bootstrap-outputs.json")
        
        if [ ! -z "$STATE_BUCKET" ]; then
            print_message "$YELLOW" "Emptying bucket: $STATE_BUCKET"
            
            # Check if bucket exists
            if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
                # Delete all objects
                aws s3 rm s3://$STATE_BUCKET --recursive
                
                # Delete all versions (if versioning is enabled)
                aws s3api list-object-versions --bucket $STATE_BUCKET --query 'Versions[].{Key:Key,VersionId:VersionId}' --output json | \
                    jq -r '.[] | "--key \"\(.Key)\" --version-id \(.VersionId)"' | \
                    while read -r line; do
                        eval "aws s3api delete-object --bucket $STATE_BUCKET $line"
                    done
                
                # Delete delete markers
                aws s3api list-object-versions --bucket $STATE_BUCKET --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' --output json | \
                    jq -r '.[] | "--key \"\(.Key)\" --version-id \(.VersionId)"' | \
                    while read -r line; do
                        eval "aws s3api delete-object --bucket $STATE_BUCKET $line"
                    done
                
                print_message "$GREEN" "✅ Bucket emptied: $STATE_BUCKET"
            else
                print_message "$YELLOW" "⚠️  Bucket not found: $STATE_BUCKET"
            fi
        fi
    fi
}

# Delete ECR images
delete_ecr_images() {
    print_message "$BLUE" "\n=== Deleting ECR Images ==="
    
    # Get ECR repositories from bootstrap outputs
    if [ -f "$TERRAFORM_DIR/bootstrap-outputs.json" ]; then
        REPOSITORIES=$(jq -r '.ecr_repositories.value | keys[]' "$TERRAFORM_DIR/bootstrap-outputs.json")
        
        for repo in $REPOSITORIES; do
            print_message "$YELLOW" "Deleting images from: $repo"
            
            # List all images
            IMAGES=$(aws ecr list-images --repository-name $repo --query 'imageIds[*]' --output json 2>/dev/null || echo "[]")
            
            if [ "$IMAGES" != "[]" ] && [ ! -z "$IMAGES" ]; then
                # Delete all images
                aws ecr batch-delete-image --repository-name $repo --image-ids "$IMAGES" &>/dev/null || true
                print_message "$GREEN" "✅ Images deleted from $repo"
            else
                print_message "$YELLOW" "⚠️  No images found in $repo"
            fi
        done
    fi
}

# Destroy bootstrap infrastructure
destroy_bootstrap() {
    print_message "$BLUE" "\n=== Destroying Bootstrap Infrastructure ==="
    
    cd "$BOOTSTRAP_DIR"
    
    # Check if terraform is initialized
    if [ ! -d ".terraform" ]; then
        print_message "$YELLOW" "Bootstrap not initialized, initializing..."
        terraform init
    fi
    
    # Destroy bootstrap
    if [ -f "terraform.tfvars" ]; then
        terraform destroy -auto-approve
    else
        print_message "$YELLOW" "⚠️  No terraform.tfvars found, skipping bootstrap destruction"
    fi
    
    print_message "$GREEN" "✅ Bootstrap infrastructure destroyed"
}

# Clean up local files
cleanup_local_files() {
    print_message "$BLUE" "\n=== Cleaning Up Local Files ==="
    
    cd "$PROJECT_ROOT"
    
    # Remove generated files
    rm -f infrastructure-outputs.json
    rm -f infrastructure/terraform/bootstrap-outputs.json
    rm -f infrastructure/terraform/tfplan
    rm -f infrastructure/terraform/bootstrap/tfplan
    rm -f .env.local
    
    # Remove terraform directories
    rm -rf infrastructure/terraform/.terraform
    rm -rf infrastructure/terraform/bootstrap/.terraform
    rm -rf infrastructure/terraform/.terraform.lock.hcl
    rm -rf infrastructure/terraform/bootstrap/.terraform.lock.hcl
    
    # Remove terraform state files (local)
    rm -f infrastructure/terraform/*.tfstate*
    rm -f infrastructure/terraform/bootstrap/*.tfstate*
    
    print_message "$GREEN" "✅ Local files cleaned up"
}

# Main execution
main() {
    print_message "$BLUE" "==================================="
    print_message "$BLUE" "    Infrastructure Teardown        "
    print_message "$BLUE" "==================================="
    
    # Safety check
    safety_check
    
    # Start teardown
    print_message "$YELLOW" "\n🔥 Starting infrastructure teardown..."
    
    # Order matters - destroy main infrastructure first
    destroy_main_infrastructure
    
    # Empty S3 buckets before destroying bootstrap
    empty_s3_buckets
    
    # Delete ECR images
    delete_ecr_images
    
    # Destroy bootstrap infrastructure
    destroy_bootstrap
    
    # Clean up local files
    cleanup_local_files
    
    print_message "$GREEN" "\n✅ All infrastructure has been destroyed"
    print_message "$YELLOW" "\n📋 Manual cleanup may be required for:"
    echo "  - CloudWatch log groups (retained for audit)"
    echo "  - Any manually created resources"
    echo "  - AWS account settings or configurations"
}

# Run main function
main "$@"