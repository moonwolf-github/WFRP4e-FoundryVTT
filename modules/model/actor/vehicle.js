import { BaseActorModel } from "./base";
import { CharacteristicModel } from "./components/characteristics";
import { VehicleDetailsModel } from "./components/details";
import { VehiclePassengersModel } from "./components/vehicle/passengers";
import { VehicleStatusModel } from "./components/vehicle/status";
let fields = foundry.data.fields;

export class VehicleModel extends BaseActorModel {
    static preventItemTypes = ["talent", "career", "disease", "injury", "mutation", "spell", "psychology", "extendedTest", "skill", "prayer", "injury"];

    static defineSchema() {
        let schema = super.defineSchema();
        schema.characteristics = new fields.SchemaField({
            t: new fields.EmbeddedDataField(CharacteristicModel)
        });
        schema.status = new fields.EmbeddedDataField(VehicleStatusModel);
        schema.details = new fields.EmbeddedDataField(VehicleDetailsModel);
        schema.passengers = new fields.EmbeddedDataField(VehiclePassengersModel);
        return schema;
    }

    preCreateData(data, options) {

        let preCreateData = super.preCreateData(data, options);
        // Set custom default token
        if (!data.img || data.img == "icons/svg/mystery-man.svg") {
            preCreateData.img = "systems/wfrp4e/tokens/vehicle.png"
        }

        return preCreateData;
    }
    
    itemIsAllowed(item) {
        let allowed = super.itemIsAllowed(item);

        // Prevent standard traits
        if (allowed && item.type == "trait")
        {
            allowed = allowed && item.system.category == "vehicle";
            if (!allowed)
            {
                ui.notifications.error("ERROR.StandardTraitsOnVehicle");
            }
        }
        return allowed
    }

    computeBase()
    {
        super.computeBase();
        this.parent.runScripts("prePrepareData", { actor: this.parent })
        this.characteristics.t.computeValue();
        this.characteristics.t.computeBonus();
        this.status.wounds.bonus = Math.floor(this.status.wounds.value / 10)
        this.details.size.value = this.details.computeSize();
        this.passengers.compute(this.parent.itemTypes.vehicleRole);
        this.crew = this.passengers.list.filter(i => i.roles?.length > 0)
        this.status.morale.compute();
        this.status.mood.compute();
    }

    computeDerived(items, flags) {
        super.computeDerived(items, flags);
        this.parent.runScripts("prePrepareItems", {actor : this.parent })
        this.characteristics.t.computeValue();
        this.characteristics.t.computeBonus();
        this.collision = this.characteristics.t.bonus + this.status.wounds.bonus
        this.computeEncumbrance(items, flags);
        this.details.move.display = this.details.formatMoveString();
        this.parent.runScripts("prepareData", { actor: this.parent })
    }


    computeEncumbrance() {
        if (!game.actors) // game.actors does not exist at startup, use existing data
            game.wfrp4e.postReadyPrepare.push(this)
        else {
            if (getProperty(this.parent, "flags.actorEnc"))
                for (let passenger of this.passengers)
                    this.status.encumbrance.current += passenger.enc;
        }

        for (let i of this.parent.items) 
        {
            i.prepareOwnedData()
            
            if (i.encumbrance && i.type != "vehicleMod")
            {
                this.status.encumbrance.current += Number(i.encumbrance.total);
            }
            this.status.encumbrance.current = this.status.encumbrance.current.toFixed(2);
        }


        this.status.encumbrance.current = Math.floor(this.status.encumbrance.current * 10) / 10;
        this.status.encumbrance.mods = this.parent.getItemTypes("vehicleMod").reduce((prev, current) => prev + current.encumbrance.total, 0)
        this.status.encumbrance.over = this.status.encumbrance.mods - this.status.encumbrance.initial
        this.status.encumbrance.over = this.status.encumbrance.over < 0 ? 0 : this.status.encumbrance.over

        this.status.encumbrance.max = this.status.carries.max
        this.status.encumbrance.pct = this.status.encumbrance.over / this.status.encumbrance.max * 100
        this.status.encumbrance.carryPct = this.status.encumbrance.current / this.status.carries.max * 100
        if (this.status.encumbrance.pct + this.status.encumbrance.carryPct > 100) {
            this.status.encumbrance.penalty = Math.floor(((this.status.encumbrance.carryPct + this.status.encumbrance.pct) - 100) / 10) // Used in handling tests
        }
    }

    get crewEffects() 
    {
        return this.parent.effects.contents.concat(this.parent.items.contents.reduce((effects, item) => effects.concat(item.effects.contents), [])).filter(e => e.applicationData.type == "crew");
    }

    static migrateData(data)
    {
        if (data.passengers instanceof Array)
        {
            data.passengers = {
                list : data.passengers
            }
        }
    }
}