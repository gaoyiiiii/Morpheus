#!/usr/bin/env ruby

require 'pathname'
require 'xcodeproj'

ROOT = Pathname.new(__dir__).parent
PROJECT_PATH = ROOT.join('ios-app', 'MorphIOS.xcodeproj')
project = Xcodeproj::Project.open(PROJECT_PATH.to_s)

ios_target = project.targets.find { |target| target.name == 'MorphIOS' }
raise 'Missing iOS target' unless ios_target

root_group = project.main_group
watch_group = root_group['MorphWatch'] || root_group.new_group('MorphWatch')
watchos_group = watch_group['watchos'] || watch_group.new_group('watchos', '../watch-app/watchos')
xcode_group = watch_group['xcode'] || watch_group.new_group('xcode', '../watch-app/xcode')
ios_bridge_group = root_group['MorphIOS']

ios_bridge_group.files.each do |file|
  next unless file.path == '../watch-app/ios-companion/IOSWatchConnectivityBridge.swift'
  file.path = 'IOSWatchConnectivityBridge.swift'
  file.source_tree = '<group>'
end

bridge_ref = ios_bridge_group.files.find { |file| file.path == 'IOSWatchConnectivityBridge.swift' } ||
  ios_bridge_group.new_file('IOSWatchConnectivityBridge.swift')
ios_target.add_file_references([bridge_ref])

watch_extension_target = project.targets.find { |target| target.name == 'MorphWatch Watch App Extension' }
unless watch_extension_target
  watch_extension_target = project.new_target(:watch2_extension, 'MorphWatch Watch App Extension', :watchos, '10.0')
end

watch_app_target = project.targets.find { |target| target.name == 'MorphWatch Watch App' }
unless watch_app_target
  watch_app_target = project.new_target(:watch2_app, 'MorphWatch Watch App', :watchos, '10.0')
end

watch_files = %w[
  MorphWatchPrototypeApp.swift
  Models.swift
  GlucoseStore.swift
  GlucoseAPIClient.swift
  FlashThoughtCaptureStore.swift
  WatchConnectivityBridge.swift
  RootWatchView.swift
]

watch_file_refs = watch_files.map do |name|
  watchos_group.files.find { |file| file.path == name } || watchos_group.new_file(name)
end
watch_extension_target.add_file_references(watch_file_refs)

watch_app_info = xcode_group.files.find { |file| file.path == 'MorphWatchApp-Info.plist' } || xcode_group.new_file('MorphWatchApp-Info.plist')
watch_ext_info = xcode_group.files.find { |file| file.path == 'MorphWatchExtension-Info.plist' } || xcode_group.new_file('MorphWatchExtension-Info.plist')
watch_assets = xcode_group.files.find { |file| file.path == 'WatchAssets.xcassets' } || xcode_group.new_file('WatchAssets.xcassets')

watch_app_target.add_resources([watch_assets]) unless watch_app_target.resources_build_phase.files_references.include?(watch_assets)

def ensure_copy_phase(project, target, name, dst_subfolder_spec)
  phase = target.copy_files_build_phases.find { |item| item.name == name }
  return phase if phase

  phase = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
  phase.name = name
  phase.dst_subfolder_spec = dst_subfolder_spec
  target.build_phases << phase
  phase
end

def ensure_shell_script_phase(project, target, name, script)
  phase = target.shell_script_build_phases.find { |item| item.name == name }
  unless phase
    phase = project.new(Xcodeproj::Project::Object::PBXShellScriptBuildPhase)
    phase.name = name
    target.build_phases << phase
  end
  phase.shell_path = '/bin/sh'
  phase.shell_script = script
  phase
end

def target_depends_on?(target, dependency_target)
  target.dependencies.any? { |dependency| dependency.target == dependency_target }
end

def phase_includes_file_ref?(phase, file_ref)
  phase.files.any? { |build_file| build_file.file_ref == file_ref }
end

embed_extensions = ensure_copy_phase(project, watch_app_target, 'Embed App Extensions', '13')
embed_watch = ensure_copy_phase(project, ios_target, 'Embed Watch Content', '16')
manual_embed_watch = ensure_shell_script_phase(
  project,
  ios_target,
  'Embed Watch Content Fallback',
  <<~SCRIPT
    set -e
    WATCH_APP_SOURCE="${BUILT_PRODUCTS_DIR}/MorphWatch Watch App.app"
    WATCH_APP_DEST="${TARGET_BUILD_DIR}/${CONTENTS_FOLDER_PATH}/Watch/MorphWatch Watch App.app"
    if [ -d "${WATCH_APP_SOURCE}" ]; then
      mkdir -p "${TARGET_BUILD_DIR}/${CONTENTS_FOLDER_PATH}/Watch"
      rm -rf "${WATCH_APP_DEST}"
      ditto "${WATCH_APP_SOURCE}" "${WATCH_APP_DEST}"
    fi
  SCRIPT
)
manual_embed_watch.input_paths = ['$(BUILT_PRODUCTS_DIR)/MorphWatch Watch App.app']
manual_embed_watch.output_paths = ['$(TARGET_BUILD_DIR)/$(CONTENTS_FOLDER_PATH)/Watch/MorphWatch Watch App.app']

unless target_depends_on?(watch_app_target, watch_extension_target)
  watch_app_target.add_dependency(watch_extension_target)
end
unless target_depends_on?(ios_target, watch_app_target)
  ios_target.add_dependency(watch_app_target)
end

unless phase_includes_file_ref?(embed_extensions, watch_extension_target.product_reference)
  embed_extensions.add_file_reference(watch_extension_target.product_reference, true)
end
unless phase_includes_file_ref?(embed_watch, watch_app_target.product_reference)
  embed_watch.add_file_reference(watch_app_target.product_reference, true)
end

ios_phases = ios_target.build_phases
shell_index = ios_phases.index(manual_embed_watch)
embed_index = ios_phases.index(embed_watch)
if shell_index && embed_index && shell_index < embed_index
  ios_phases.move_from(shell_index, embed_index + 1)
end

project.root_object.attributes['TargetAttributes'] ||= {}
project.root_object.attributes['TargetAttributes'][watch_extension_target.uuid] ||= { 'CreatedOnToolsVersion' => '16.0' }
project.root_object.attributes['TargetAttributes'][watch_app_target.uuid] ||= { 'CreatedOnToolsVersion' => '16.0' }

if (watch_icons_group = xcode_group['WatchIcons'])
  watch_icons_group.files.each do |file|
    watch_app_target.resources_build_phase.files.each do |build_file|
      next unless build_file.file_ref == file
      watch_app_target.resources_build_phase.remove_build_file(build_file)
    end
  end
end

[watch_app_info, watch_ext_info].each do |plist_ref|
  watch_app_target.resources_build_phase.files.each do |build_file|
    next unless build_file.file_ref == plist_ref
    watch_app_target.resources_build_phase.remove_build_file(build_file)
  end

  watch_extension_target.resources_build_phase.files.each do |build_file|
    next unless build_file.file_ref == plist_ref
    watch_extension_target.resources_build_phase.remove_build_file(build_file)
  end
end

ios_target.build_configurations.each do |config|
  config.build_settings['EMBEDDED_CONTENT_CONTAINS_SWIFT'] = 'YES'
  config.build_settings['ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES'] = 'YES'
  config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
end

watch_app_target.build_configurations.each do |config|
  config.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['INFOPLIST_FILE'] = '../watch-app/xcode/MorphWatchApp-Info.plist'
  config.build_settings['MARKETING_VERSION'] = '1.0'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.yiiiii.MorphIOS.watchkitapp'
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  config.build_settings['SDKROOT'] = 'watchos'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['SUPPORTED_PLATFORMS'] = 'watchos'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '4'
  config.build_settings['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
end

watch_extension_target.build_configurations.each do |config|
  config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  config.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  config.build_settings['INFOPLIST_FILE'] = '../watch-app/xcode/MorphWatchExtension-Info.plist'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = [
    '$(inherited)',
    '@executable_path/Frameworks',
    '@executable_path/../../Frameworks',
  ]
  config.build_settings['MARKETING_VERSION'] = '1.0'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.yiiiii.MorphIOS.watchkitapp.watchkitextension'
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  config.build_settings['SDKROOT'] = 'watchos'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['SUPPORTED_PLATFORMS'] = 'watchos'
  config.build_settings['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '4'
  config.build_settings['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
end

project.save
